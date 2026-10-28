const { query } = require('../db');

let ioInstance = null;

function setSocketIo(io) {
  ioInstance = io;
}

async function createNotification({ userId, notificationType, title, body, auctionId = null, saleId = null }) {
  try {
    const res = await query(
      `INSERT INTO notifications (user_id, notification_type, title, body, auction_id, sale_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, notificationType, title, body, auctionId, saleId]
    );

    const notification = res.rows[0];

    // Push live via Socket.IO if user is connected
    if (ioInstance) {
      ioInstance.to(`user:${userId}`).emit('new_notification', notification);
    }

    return notification;
  } catch (err) {
    console.error('Error creating notification:', err.message);
    return null;
  }
}

async function notifyOutbid({ userId, auctionId, auctionTitle, newPrice, currentLeaderName }) {
  return createNotification({
    userId,
    notificationType: 'outbid',
    title: 'Outbid Alert!',
    body: `You were outbid on "${auctionTitle}". The current leading bid is now ₹${parseFloat(newPrice).toFixed(2)} by ${currentLeaderName}.`,
    auctionId
  });
}

async function notifyBidderBidAccepted({ userId, auctionId, auctionTitle, amount, isAutomatic = false }) {
  return createNotification({
    userId,
    notificationType: 'bid_accepted',
    title: isAutomatic ? 'Automatic Bid Placed' : 'Bid Placed Successfully',
    body: `Your ${isAutomatic ? 'automatic ' : ''}bid of ₹${parseFloat(amount).toFixed(2)} was accepted for "${auctionTitle}".`,
    auctionId
  });
}

async function notifySellerBidReceived({ userId, auctionId, auctionTitle, amount, bidderName }) {
  return createNotification({
    userId,
    notificationType: 'bid_received',
    title: 'New Bid Received',
    body: `${bidderName} placed a bid of ₹${parseFloat(amount).toFixed(2)} on "${auctionTitle}".`,
    auctionId
  });
}

async function notifyAuctionWonBuyer({ buyerId, auctionId, saleId, auctionTitle, finalPrice }) {
  return createNotification({
    userId: buyerId,
    notificationType: 'auction_won',
    title: 'Auction Won! 🎉',
    body: `You won the auction for "${auctionTitle}" at ₹${parseFloat(finalPrice).toFixed(2)}. The seller will review and confirm handover details soon.`,
    auctionId,
    saleId
  });
}

async function notifyAuctionClosedSeller({ sellerId, auctionId, saleId, auctionTitle, finalPrice, buyerName, hasBids }) {
  if (hasBids) {
    return createNotification({
      userId: sellerId,
      notificationType: 'auction_closed_bids',
      title: 'Auction Closed with Winner! 💰',
      body: `"${auctionTitle}" closed at ₹${parseFloat(finalPrice).toFixed(2)} with winning bid by ${buyerName}. Please approve or reject the sale.`,
      auctionId,
      saleId
    });
  } else {
    return createNotification({
      userId: sellerId,
      notificationType: 'auction_closed_unsold',
      title: 'Auction Ended (Unsold)',
      body: `Your auction "${auctionTitle}" ended with no bids placed. You can re-list it with adjusted pricing or duration.`,
      auctionId
    });
  }
}

async function notifySellerDecision({ buyerId, auctionId, saleId, auctionTitle, approved, notes }) {
  return createNotification({
    userId: buyerId,
    notificationType: approved ? 'sale_approved' : 'sale_rejected',
    title: approved ? 'Sale Approved by Seller! ✅' : 'Sale Rejected by Seller ❌',
    body: approved
      ? `The seller approved your purchase of "${auctionTitle}". Please meet at the designated campus location to confirm handover.`
      : `The seller did not accept the final bid for "${auctionTitle}". ${notes ? `Reason: ${notes}` : ''}`,
    auctionId,
    saleId
  });
}

async function notifyHandoverConfirmation({ recipientId, auctionId, saleId, auctionTitle, confirmedByName, isComplete }) {
  return createNotification({
    userId: recipientId,
    notificationType: isComplete ? 'sale_completed' : 'handover_pending',
    title: isComplete ? 'Transaction Completed! 🤝' : 'Handover Confirmed',
    body: isComplete
      ? `Both parties confirmed handover for "${auctionTitle}". The transaction is successfully complete!`
      : `${confirmedByName} confirmed handover for "${auctionTitle}". Please submit your confirmation once you receive/hand over the item.`,
    auctionId,
    saleId
  });
}

async function notifySavedSearchMatch({ userId, auctionId, auctionTitle, startingPrice, searchName }) {
  return createNotification({
    userId,
    notificationType: 'saved_search_match',
    title: `New Match: ${searchName} 🔍`,
    body: `A new item matching your saved search was listed: "${auctionTitle}" starting at ₹${parseFloat(startingPrice).toFixed(2)}.`,
    auctionId
  });
}

async function notifyAdmins({ notificationType, title, body, auctionId = null, saleId = null, excludeUserId = null }) {
  const admins = await query(
    `SELECT id
     FROM users
     WHERE is_admin = TRUE
       AND account_status = 'active'
       AND ($1::uuid IS NULL OR id <> $1::uuid)`,
    [excludeUserId]
  );

  return Promise.all(admins.rows.map((admin) => createNotification({
    userId: admin.id,
    notificationType,
    title,
    body,
    auctionId,
    saleId
  })));
}

module.exports = {
  setSocketIo,
  createNotification,
  notifyOutbid,
  notifyBidderBidAccepted,
  notifySellerBidReceived,
  notifyAuctionWonBuyer,
  notifyAuctionClosedSeller,
  notifySellerDecision,
  notifyHandoverConfirmation,
  notifySavedSearchMatch,
  notifyAdmins
};
