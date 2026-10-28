const { v4: uuidv4 } = require('uuid');
const { transaction, query } = require('../db');
const {
  notifyAdmins,
  notifyBidderBidAccepted,
  notifyOutbid,
  notifySellerBidReceived
} = require('./notificationService');

let ioInstance = null;

function setSocketIo(io) {
  ioInstance = io;
}

/**
 * Places a bid with full transactional locking and anti-sniping rules.
 */
async function placeBid({ auctionId, bidderId, amount, bidType = 'manual', autoBidLimitId = null, requestKey = null }) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw new Error('Bid amount must be a positive number.');
  }

  const reqKey = requestKey || uuidv4();
  let previousHighBidderId = null;
  let sellerId = null;
  let auctionTitle = '';
  let updatedAuction = null;
  let wasExtended = false;
  let newEndTime = null;
  let acceptedBid = null;

  // Execute in database transaction with row lock
  await transaction(async (tx) => {
    // 1. Lock auction row for update to serialize concurrent bids
    const auctionRes = await tx.query(
      `SELECT a.*, u.display_name AS seller_name
       FROM auctions a
       JOIN users u ON a.seller_id = u.id
       WHERE a.id = $1
       FOR UPDATE`,
      [auctionId]
    );

    if (auctionRes.rows.length === 0) {
      throw new Error('Auction not found.');
    }

    const auction = auctionRes.rows[0];
    auctionTitle = auction.title;
    sellerId = auction.seller_id;
    previousHighBidderId = auction.current_high_bidder_id;

    // 2. Validate auction status
    if (auction.status !== 'active') {
      throw new Error(`Auction is not open for bidding (status: ${auction.status}).`);
    }

    const now = new Date();
    const auctionEndTime = new Date(auction.end_time);

    // 3. Validate auction closing time
    if (now >= auctionEndTime) {
      throw new Error('Auction has already closed.');
    }

    // 4. Validate bidder is not the seller
    if (auction.seller_id === bidderId) {
      throw new Error('Sellers cannot place bids on their own items.');
    }

    // 5. Validate bidder is not already the high bidder
    if (auction.current_high_bidder_id === bidderId) {
      throw new Error('You are already the leading bidder for this auction.');
    }

    const startingPrice = parseFloat(auction.starting_price);
    const minIncrement = parseFloat(auction.min_bid_increment);
    const currentPrice = auction.current_price !== null ? parseFloat(auction.current_price) : null;

    // 6. Validate price rule
    if (currentPrice === null) {
      if (numericAmount < startingPrice) {
        throw new Error(`First bid must be at least the starting price of ₹${startingPrice.toFixed(2)}.`);
      }
    } else {
      const minRequired = currentPrice + minIncrement;
      // Precision comparison (rounded to 2 decimal places)
      if (Math.round(numericAmount * 100) < Math.round(minRequired * 100)) {
        throw new Error(
          `Bid amount of ₹${numericAmount.toFixed(2)} is below minimum required bid of ₹${minRequired.toFixed(2)} ` +
          `(current ₹${currentPrice.toFixed(2)} + min increment ₹${minIncrement.toFixed(2)}).`
        );
      }
    }

    // 7. Anti-sniping logic:
    // If bid arrives within the final 30 seconds, extend closing time to acceptance time + 60 seconds
    const timeLeftMs = auctionEndTime.getTime() - now.getTime();
    if (timeLeftMs <= 30000) {
      wasExtended = true;
      newEndTime = new Date(now.getTime() + 60000);

      await tx.query(
        `UPDATE auctions
         SET end_time = $1, updated_at = NOW()
         WHERE id = $2`,
        [newEndTime, auctionId]
      );

      await tx.query(
        `INSERT INTO auction_events (auction_id, actor_id, event_type, payload, is_public)
         VALUES ($1, $2, 'anti_snipe_extended', $3, TRUE)`,
        [
          auctionId,
          bidderId,
          JSON.stringify({
            previous_end_time: auction.end_time,
            new_end_time: newEndTime,
            extension_seconds: 60,
            trigger_bid_amount: numericAmount
          })
        ]
      );
    }

    // 8. Insert accepted bid
    const bidRes = await tx.query(
      `INSERT INTO bids (auction_id, bidder_id, amount, bid_type, auto_bid_limit_id, request_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [auctionId, bidderId, numericAmount, bidType, autoBidLimitId, reqKey]
    );
    acceptedBid = bidRes.rows[0];

    // 9. Atomically update auctions snapshot
    const updateRes = await tx.query(
      `UPDATE auctions
       SET current_price = $1,
           current_high_bidder_id = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [numericAmount, bidderId, auctionId]
    );
    updatedAuction = updateRes.rows[0];

    // 10. Record accepted bid event in auction_events
    await tx.query(
      `INSERT INTO auction_events (auction_id, actor_id, event_type, payload, is_public)
       VALUES ($1, $2, 'bid_accepted', $3, TRUE)`,
      [
        auctionId,
        bidderId,
        JSON.stringify({
          bid_id: acceptedBid.id,
          amount: numericAmount,
          bid_type: bidType,
          auto_bid_limit_id: autoBidLimitId
        })
      ]
    );
  });

  // After transaction commit:
  // 1. Fetch bidder's display name for notifications and live broadcast
  const bidderRes = await query('SELECT display_name FROM users WHERE id = $1', [bidderId]);
  const bidderDisplayName = bidderRes.rows[0]?.display_name || 'Anonymous Student';

  // 2. Notify the bidder, seller, and administrators immediately after acceptance.
  await Promise.all([
    notifyBidderBidAccepted({
      userId: bidderId,
      auctionId,
      auctionTitle,
      amount: numericAmount,
      isAutomatic: bidType === 'automatic'
    }),
    notifySellerBidReceived({
      userId: sellerId,
      auctionId,
      auctionTitle,
      amount: numericAmount,
      bidderName: bidderDisplayName
    }),
    notifyAdmins({
      notificationType: 'bid_received',
      title: 'New Bid Received',
      body: `${bidderDisplayName} bid ₹${numericAmount.toFixed(2)} on "${auctionTitle}".`,
      auctionId
    })
  ]);

  // 3. Notify previous high bidder that they were outbid
  if (previousHighBidderId && previousHighBidderId !== bidderId) {
    await notifyOutbid({
      userId: previousHighBidderId,
      auctionId,
      auctionTitle,
      newPrice: numericAmount,
      currentLeaderName: bidderDisplayName
    });
  }

  // 4. Broadcast real-time update via Socket.IO
  if (ioInstance) {
    const payload = {
      auctionId,
      current_price: numericAmount,
      current_high_bidder_id: bidderId,
      current_high_bidder_name: bidderDisplayName,
      end_time: wasExtended ? newEndTime : updatedAuction.end_time,
      wasExtended,
      bid: {
        id: acceptedBid.id,
        amount: numericAmount,
        bid_type: bidType,
        created_at: acceptedBid.created_at,
        bidder_display_name: bidderDisplayName
      }
    };

    ioInstance.to(`auction:${auctionId}`).emit('auction_update', payload);
    ioInstance.emit('global_auction_update', {
      auctionId,
      current_price: numericAmount,
      end_time: wasExtended ? newEndTime : updatedAuction.end_time
    });
  }

  // 5. Trigger auto-bid evaluation if any other user has set an automatic bid limit
  triggerAutoBids(auctionId, bidderId, numericAmount).catch(err => {
    console.error('Error during auto-bid evaluation:', err.message);
  });

  return {
    success: true,
    bid: acceptedBid,
    currentPrice: numericAmount,
    wasExtended,
    newEndTime: wasExtended ? newEndTime : updatedAuction.end_time
  };
}

/**
 * Evaluates and executes automatic counter-bids from buyers who set auto_bid_limits.
 */
async function triggerAutoBids(auctionId, currentLeaderId, currentPrice) {
  // Find highest active auto-bid limit for this auction by other users
  const autoBidRes = await query(
    `SELECT abl.*, u.display_name
     FROM auto_bid_limits abl
     JOIN users u ON abl.bidder_id = u.id
     WHERE abl.auction_id = $1
       AND abl.is_active = TRUE
       AND abl.bidder_id != $2
       AND abl.maximum_amount > $3
     ORDER BY abl.maximum_amount DESC, abl.created_at ASC
     LIMIT 1`,
    [auctionId, currentLeaderId, currentPrice]
  );

  if (autoBidRes.rows.length === 0) return;

  const autoBid = autoBidRes.rows[0];

  // Fetch auction details for increment
  const aucRes = await query('SELECT min_bid_increment, starting_price, status, end_time FROM auctions WHERE id = $1', [auctionId]);
  if (aucRes.rows.length === 0) return;
  const auction = aucRes.rows[0];

  if (auction.status !== 'active' || new Date() >= new Date(auction.end_time)) return;

  const minIncrement = parseFloat(auction.min_bid_increment);
  const maxLimit = parseFloat(autoBid.maximum_amount);
  const nextTarget = currentPrice + minIncrement;

  if (nextTarget <= maxLimit) {
    try {
      console.log(`[Auto-Bid Engine] Placing proxy bid ₹${nextTarget} for user ${autoBid.display_name}`);
      await placeBid({
        auctionId,
        bidderId: autoBid.bidder_id,
        amount: nextTarget,
        bidType: 'automatic',
        autoBidLimitId: autoBid.id
      });
    } catch (err) {
      console.log('[Auto-Bid Engine] Counter-bid failed:', err.message);
    }
  }
}

/**
 * Set or update a user's auto-bid limit for an auction.
 */
async function setAutoBidLimit({ auctionId, userId, maximumAmount }) {
  const maxAmount = parseFloat(maximumAmount);
  if (isNaN(maxAmount) || maxAmount <= 0) {
    throw new Error('Maximum auto-bid amount must be a positive value.');
  }

  // Validate auction
  const aucRes = await query(
    'SELECT seller_id, current_price, starting_price, min_bid_increment, status, end_time FROM auctions WHERE id = $1',
    [auctionId]
  );
  if (aucRes.rows.length === 0) throw new Error('Auction not found.');
  const auction = aucRes.rows[0];

  if (auction.seller_id === userId) {
    throw new Error('Sellers cannot set auto-bids on their own auctions.');
  }
  if (auction.status !== 'active' || new Date() >= new Date(auction.end_time)) {
    throw new Error('Auction is not open.');
  }

  const currentPrice = auction.current_price !== null ? parseFloat(auction.current_price) : null;
  const startingPrice = parseFloat(auction.starting_price);
  const minRequired = currentPrice !== null ? currentPrice + parseFloat(auction.min_bid_increment) : startingPrice;

  if (maxAmount < minRequired) {
    throw new Error(`Your maximum limit must be at least ₹${minRequired.toFixed(2)}.`);
  }

  // Upsert auto_bid_limits
  const res = await query(
    `INSERT INTO auto_bid_limits (auction_id, bidder_id, maximum_amount, is_active, updated_at)
     VALUES ($1, $2, $3, TRUE, NOW())
     ON CONFLICT (auction_id, bidder_id)
     DO UPDATE SET maximum_amount = $3, is_active = TRUE, updated_at = NOW()
     RETURNING *`,
    [auctionId, userId, maxAmount]
  );

  const autoBid = res.rows[0];

  // If user is not currently the leading bidder, immediately place minimum needed bid
  const currAuction = await query('SELECT current_high_bidder_id FROM auctions WHERE id = $1', [auctionId]);
  if (currAuction.rows[0]?.current_high_bidder_id !== userId) {
    await placeBid({
      auctionId,
      bidderId: userId,
      amount: minRequired,
      bidType: 'automatic',
      autoBidLimitId: autoBid.id
    }).catch(err => {
      console.log('Immediate auto-bid attempt:', err.message);
    });
  }

  return autoBid;
}

module.exports = {
  setSocketIo,
  placeBid,
  setAutoBidLimit
};
