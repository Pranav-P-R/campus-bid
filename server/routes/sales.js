const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  notifySellerDecision,
  notifyHandoverConfirmation
} = require('../services/notificationService');

let ioInstance = null;
function setSocketIo(io) {
  ioInstance = io;
}

// GET /api/sales (List user's purchases and sales)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { role } = req.query; // 'seller', 'buyer', or all
    let sql = `
      SELECT
        s.*,
        a.title AS auction_title,
        a.item_condition,
        (SELECT image_url FROM auction_images WHERE auction_id = a.id ORDER BY sort_order ASC LIMIT 1) AS primary_image,
        seller.display_name AS seller_name,
        buyer.display_name AS buyer_name,
        (SELECT COUNT(*)::int FROM handover_confirmations WHERE sale_id = s.id) AS confirmation_count,
        EXISTS (SELECT 1 FROM handover_confirmations WHERE sale_id = s.id AND user_id = $1) AS has_confirmed
      FROM sales s
      JOIN auctions a ON s.auction_id = a.id
      JOIN users seller ON s.seller_id = seller.id
      LEFT JOIN users buyer ON s.buyer_id = buyer.id
      WHERE (s.seller_id = $1 OR s.buyer_id = $1)
    `;
    const params = [req.user.id];

    if (role === 'seller') {
      sql += ` AND s.seller_id = $1`;
    } else if (role === 'buyer') {
      sql += ` AND s.buyer_id = $1`;
    }

    sql += ` ORDER BY s.created_at DESC`;

    const result = await query(sql, params);
    return res.json({ sales: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/sales/:id (Detailed sale status)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const saleRes = await query(
      `SELECT
        s.*,
        a.title AS auction_title,
        a.description AS auction_description,
        a.item_condition,
        a.starting_price,
        a.current_price,
        (SELECT json_agg(image_url ORDER BY sort_order ASC) FROM auction_images WHERE auction_id = a.id) AS images,
        seller.display_name AS seller_name,
        buyer.display_name AS buyer_name
       FROM sales s
       JOIN auctions a ON s.auction_id = a.id
       JOIN users seller ON s.seller_id = seller.id
       LEFT JOIN users buyer ON s.buyer_id = buyer.id
       WHERE s.id = $1 AND (s.seller_id = $2 OR s.buyer_id = $2 OR $3 = TRUE)`,
      [id, req.user.id, req.user.is_admin]
    );

    if (saleRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sale record not found or access denied.' });
    }

    const sale = saleRes.rows[0];

    // Fetch handover confirmations
    const confRes = await query(
      `SELECT hc.*, u.display_name AS user_name
       FROM handover_confirmations hc
       JOIN users u ON hc.user_id = u.id
       WHERE hc.sale_id = $1
       ORDER BY hc.confirmed_at ASC`,
      [id]
    );

    return res.json({
      sale,
      confirmations: confRes.rows,
      isSeller: req.user.id === sale.seller_id,
      isBuyer: req.user.id === sale.buyer_id,
      hasMyConfirmation: confRes.rows.some(c => c.user_id === req.user.id)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/sales/:id/decision (Seller approve/reject winning price)
router.post('/:id/decision', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, notes = '' } = req.body;

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be either "approve" or "reject".' });
    }

    let updatedSale = null;

    await transaction(async (tx) => {
      const saleRes = await tx.query(
        `SELECT s.*, a.title AS auction_title FROM sales s
         JOIN auctions a ON s.auction_id = a.id
         WHERE s.id = $1 FOR UPDATE`,
        [id]
      );

      if (saleRes.rows.length === 0) throw new Error('Sale not found');
      const sale = saleRes.rows[0];

      if (sale.seller_id !== req.user.id && !req.user.is_admin) {
        throw new Error('Only the seller can approve or reject the sale outcome.');
      }

      if (sale.status !== 'pending_seller_approval') {
        throw new Error(`Sale is already marked as ${sale.status}.`);
      }

      const isApproved = decision === 'approve';
      const newStatus = isApproved ? 'reserved' : 'rejected';

      const updateRes = await tx.query(
        `UPDATE sales
         SET status = $1,
             seller_decided_at = NOW(),
             reserved_at = CASE WHEN $2 = TRUE THEN NOW() ELSE NULL END,
             failure_reason = CASE WHEN $2 = FALSE THEN $3 ELSE NULL END,
             outcome_notes = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [newStatus, isApproved, notes, id]
      );
      updatedSale = updateRes.rows[0];

      // Audit trail
      await tx.query(
        `INSERT INTO auction_events (auction_id, actor_id, event_type, payload)
         VALUES ($1, $2, $3, $4)`,
        [
          sale.auction_id,
          req.user.id,
          isApproved ? 'seller_approved_sale' : 'seller_rejected_sale',
          JSON.stringify({ notes })
        ]
      );

      // Notify buyer
      if (sale.buyer_id) {
        notifySellerDecision({
          buyerId: sale.buyer_id,
          auctionId: sale.auction_id,
          saleId: id,
          auctionTitle: sale.auction_title,
          approved: isApproved,
          notes
        }).catch(err => console.error('Error sending seller decision alert:', err));
      }
    });

    if (ioInstance) {
      ioInstance.emit('sale_status_updated', {
        saleId: id,
        status: updatedSale.status
      });
    }

    return res.json({
      message: decision === 'approve'
        ? 'Sale approved! Item is reserved. Coordinate campus handover with the buyer.'
        : 'Sale rejected.',
      sale: updatedSale
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/sales/:id/handover-confirmations (Dual confirmation of physical pickup)
router.post('/:id/handover-confirmations', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { note = '' } = req.body;

    let isCompleted = false;
    let saleRecord = null;

    await transaction(async (tx) => {
      const saleRes = await tx.query(
        `SELECT s.*, a.title AS auction_title FROM sales s
         JOIN auctions a ON s.auction_id = a.id
         WHERE s.id = $1 FOR UPDATE`,
        [id]
      );

      if (saleRes.rows.length === 0) throw new Error('Sale not found');
      saleRecord = saleRes.rows[0];

      if (saleRecord.seller_id !== req.user.id && saleRecord.buyer_id !== req.user.id && !req.user.is_admin) {
        throw new Error('Only the buyer or seller can confirm item handover.');
      }

      if (saleRecord.status !== 'reserved' && saleRecord.status !== 'completed') {
        throw new Error(`Cannot confirm handover when sale status is ${saleRecord.status}. Must be reserved.`);
      }

      // Insert confirmation
      await tx.query(
        `INSERT INTO handover_confirmations (sale_id, user_id, note)
         VALUES ($1, $2, $3)
         ON CONFLICT (sale_id, user_id)
         DO UPDATE SET confirmed_at = NOW(), note = $3`,
        [id, req.user.id, note.trim()]
      );

      // Check if both sides (buyer and seller) have confirmed
      const bothRes = await tx.query(
        `SELECT user_id FROM handover_confirmations WHERE sale_id = $1`,
        [id]
      );

      const confirmedUserIds = bothRes.rows.map(r => r.user_id);
      const hasSellerConfirmed = confirmedUserIds.includes(saleRecord.seller_id);
      const hasBuyerConfirmed = confirmedUserIds.includes(saleRecord.buyer_id);

      if (hasSellerConfirmed && hasBuyerConfirmed) {
        isCompleted = true;
        await tx.query(
          `UPDATE sales
           SET status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [id]
        );

        await tx.query(
          `INSERT INTO auction_events (auction_id, actor_id, event_type, payload)
           VALUES ($1, $2, 'handover_completed', '{"status": "completed"}')`,
          [saleRecord.auction_id, req.user.id]
        );
      }
    });

    const otherUserId = req.user.id === saleRecord.seller_id ? saleRecord.buyer_id : saleRecord.seller_id;
    if (otherUserId) {
      notifyHandoverConfirmation({
        recipientId: otherUserId,
        auctionId: saleRecord.auction_id,
        saleId: id,
        auctionTitle: saleRecord.auction_title,
        confirmedByName: req.user.display_name,
        isComplete: isCompleted
      }).catch(err => console.error(err));
    }

    if (ioInstance) {
      ioInstance.emit('sale_status_updated', {
        saleId: id,
        status: isCompleted ? 'completed' : 'reserved'
      });
    }

    return res.json({
      message: isCompleted
        ? 'Both parties have confirmed handover! The transaction is officially COMPLETED. 🎉'
        : 'Your handover confirmation was recorded. Waiting for the other party to confirm.',
      isCompleted
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/sales/:id/fail-pickup (Mark pickup failed)
router.post('/:id/fail-pickup', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Buyer/Seller did not show up at meetup location' } = req.body;

    await transaction(async (tx) => {
      const saleRes = await tx.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [id]);
      if (saleRes.rows.length === 0) throw new Error('Sale not found');
      const sale = saleRes.rows[0];

      if (sale.seller_id !== req.user.id && sale.buyer_id !== req.user.id && !req.user.is_admin) {
        throw new Error('Unauthorized');
      }

      await tx.query(
        `UPDATE sales
         SET status = 'pickup_failed', failed_at = NOW(), failure_reason = $1, updated_at = NOW()
         WHERE id = $2`,
        [reason, id]
      );

      await tx.query(
        `INSERT INTO auction_events (auction_id, actor_id, event_type, payload)
         VALUES ($1, $2, 'pickup_failed', $3)`,
        [sale.auction_id, req.user.id, JSON.stringify({ reason })]
      );
    });

    if (ioInstance) {
      ioInstance.emit('sale_status_updated', { saleId: id, status: 'pickup_failed' });
    }

    return res.json({ message: 'Pickup marked as failed.' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = {
  router,
  setSocketIo
};

