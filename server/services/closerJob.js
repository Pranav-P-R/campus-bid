const { transaction, query } = require('../db');
const {
  notifyAuctionWonBuyer,
  notifyAuctionClosedSeller
} = require('./notificationService');

let ioInstance = null;
let timerId = null;

function setSocketIo(io) {
  ioInstance = io;
}

/**
 * Checks for expired active auctions and closes them idempotently within a transaction.
 */
async function closeExpiredAuctions() {
  try {
    // 1. Find all active auctions that have expired
    const expiredRes = await query(
      `SELECT id, title, seller_id, current_price, current_high_bidder_id
       FROM auctions
       WHERE status = 'active' AND end_time <= NOW()`
    );

    if (expiredRes.rows.length === 0) return;

    for (const auction of expiredRes.rows) {
      try {
        let saleRecord = null;
        let isUnsold = false;
        let winningBid = null;
        let buyerDisplayName = 'Unknown';

        await transaction(async (tx) => {
          // Row lock to ensure exactly-once closure
          const lockRes = await tx.query(
            `SELECT * FROM auctions WHERE id = $1 FOR UPDATE`,
            [auction.id]
          );

          if (lockRes.rows.length === 0) return;
          const currentAuction = lockRes.rows[0];

          if (currentAuction.status !== 'active') return; // Already closed by another worker

          // Update status to closed
          await tx.query(
            `UPDATE auctions
             SET status = 'closed', closed_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [auction.id]
          );

          if (!currentAuction.current_high_bidder_id) {
            // Unsold case
            isUnsold = true;
            const saleRes = await tx.query(
              `INSERT INTO sales (auction_id, seller_id, status, outcome_notes)
               VALUES ($1, $2, 'unsold', 'Auction concluded with zero bids.')
               ON CONFLICT (auction_id) DO NOTHING
               RETURNING *`,
              [auction.id, currentAuction.seller_id]
            );
            saleRecord = saleRes.rows[0];

            await tx.query(
              `INSERT INTO auction_events (auction_id, actor_id, event_type, payload, is_public)
               VALUES ($1, $2, 'closed_unsold', '{"reason": "no_bids"}', TRUE)`,
              [auction.id, currentAuction.seller_id]
            );
          } else {
            // Winning bid case
            const bidRes = await tx.query(
              `SELECT b.*, u.display_name AS buyer_name
               FROM bids b
               JOIN users u ON b.bidder_id = u.id
               WHERE b.auction_id = $1
               ORDER BY b.amount DESC, b.created_at ASC
               LIMIT 1`,
              [auction.id]
            );

            winningBid = bidRes.rows[0];
            buyerDisplayName = winningBid?.buyer_name || 'Winning Bidder';

            const saleRes = await tx.query(
              `INSERT INTO sales (auction_id, seller_id, buyer_id, winning_bid_id, final_price, status)
               VALUES ($1, $2, $3, $4, $5, 'pending_seller_approval')
               ON CONFLICT (auction_id) DO NOTHING
               RETURNING *`,
              [
                auction.id,
                currentAuction.seller_id,
                currentAuction.current_high_bidder_id,
                winningBid?.id,
                currentAuction.current_price
              ]
            );
            saleRecord = saleRes.rows[0];

            await tx.query(
              `INSERT INTO auction_events (auction_id, actor_id, event_type, payload, is_public)
               VALUES ($1, $2, 'closed_with_winner', $3, TRUE)`,
              [
                auction.id,
                currentAuction.seller_id,
                JSON.stringify({
                  buyer_id: currentAuction.current_high_bidder_id,
                  final_price: currentAuction.current_price,
                  winning_bid_id: winningBid?.id
                })
              ]
            );
          }
        });

        // Outside transaction - fire notifications & websocket broadcast
        if (isUnsold) {
          console.log(`[Auction Closer] Auction "${auction.title}" closed unsold.`);
          await notifyAuctionClosedSeller({
            sellerId: auction.seller_id,
            auctionId: auction.id,
            saleId: saleRecord?.id,
            auctionTitle: auction.title,
            finalPrice: 0,
            buyerName: null,
            hasBids: false
          });

          if (ioInstance) {
            ioInstance.to(`auction:${auction.id}`).emit('auction_closed', {
              auctionId: auction.id,
              status: 'closed',
              outcome: 'unsold'
            });
            ioInstance.emit('global_auction_update', {
              auctionId: auction.id,
              status: 'closed'
            });
          }
        } else if (winningBid && saleRecord) {
          console.log(`[Auction Closer] Auction "${auction.title}" closed with winner: ₹${auction.current_price}`);
          await notifyAuctionWonBuyer({
            buyerId: auction.current_high_bidder_id,
            auctionId: auction.id,
            saleId: saleRecord.id,
            auctionTitle: auction.title,
            finalPrice: auction.current_price
          });

          await notifyAuctionClosedSeller({
            sellerId: auction.seller_id,
            auctionId: auction.id,
            saleId: saleRecord.id,
            auctionTitle: auction.title,
            finalPrice: auction.current_price,
            buyerName: buyerDisplayName,
            hasBids: true
          });

          if (ioInstance) {
            ioInstance.to(`auction:${auction.id}`).emit('auction_closed', {
              auctionId: auction.id,
              status: 'closed',
              outcome: 'pending_seller_approval',
              saleId: saleRecord.id,
              finalPrice: auction.current_price,
              winnerName: buyerDisplayName
            });
            ioInstance.emit('global_auction_update', {
              auctionId: auction.id,
              status: 'closed'
            });
          }
        }
      } catch (itemErr) {
        console.error(`Error closing auction ${auction.id}:`, itemErr.message);
      }
    }
  } catch (err) {
    console.error('Error in closeExpiredAuctions:', err.message);
  }
}

function startAuctionCloser(intervalMs = 3000) {
  if (timerId) clearInterval(timerId);
  timerId = setInterval(closeExpiredAuctions, intervalMs);
  console.log(`Auction Closer worker scheduled every ${intervalMs}ms.`);
}

function stopAuctionCloser() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

module.exports = {
  setSocketIo,
  closeExpiredAuctions,
  startAuctionCloser,
  stopAuctionCloser
};

