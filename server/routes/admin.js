const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { createNotification, notifyAdmins } = require('../services/notificationService');

router.use(requireAdmin);

router.get('/overview', async (req, res) => {
  try {
    const [users, auctions, sales, pending] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE account_status = 'active')::int AS active,
             COUNT(*) FILTER (WHERE account_status <> 'active')::int AS flagged FROM users`),
      query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'active')::int AS active,
             COUNT(*) FILTER (WHERE status = 'closed')::int AS closed FROM auctions`),
      query(`SELECT COUNT(*)::int AS total, COALESCE(SUM(final_price), 0)::numeric AS volume FROM sales`),
      query(`SELECT COUNT(*)::int AS total FROM questions WHERE visibility = 'pending_review'`)
    ]);
    return res.json({
      users: users.rows[0],
      auctions: auctions.rows[0],
      sales: sales.rows[0],
      moderation: pending.rows[0]
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, full_name, display_name, email, account_type, is_admin, account_status, created_at
       FROM users ORDER BY created_at DESC LIMIT 100`
    );
    return res.json({ users: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'disabled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid account status.' });
  }
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own account status.' });
  }
  try {
    const result = await query(
      `UPDATE users SET account_status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, display_name, account_status`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/auctions', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.title, a.status, a.current_price, a.end_time, u.display_name AS seller_name
       FROM auctions a JOIN users u ON u.id = a.seller_id
       ORDER BY a.created_at DESC LIMIT 100`
    );
    return res.json({ auctions: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/auctions/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Admins may only activate or cancel auctions.' });
  }
  try {
    const result = await transaction(async (tx) => {
      const auctionResult = await tx.query(
        `UPDATE auctions SET status = $1::varchar, cancellation_reason = CASE WHEN $1::varchar = 'cancelled' THEN 'Cancelled by campus administrator' ELSE NULL END,
         updated_at = NOW() WHERE id = $2 RETURNING id, status, seller_id, title`,
        [status, req.params.id]
      );
      if (auctionResult.rows.length === 0) return null;

      if (status === 'cancelled') {
        await tx.query(
          `UPDATE sales
           SET status = 'cancelled', failure_reason = 'Blocked by campus administrator', updated_at = NOW()
           WHERE auction_id = $1 AND status IN ('pending_seller_approval', 'reserved')`,
          [req.params.id]
        );
        await tx.query(
          `INSERT INTO auction_events (auction_id, actor_id, event_type, payload)
           VALUES ($1, $2, 'admin_auction_cancelled', $3)`,
          [req.params.id, req.user.id, JSON.stringify({ reason: 'Blocked by campus administrator' })]
        );
      }
      return auctionResult.rows[0];
    });
    if (!result) return res.status(404).json({ error: 'Auction not found.' });

    if (status === 'cancelled') {
      await createNotification({
        userId: result.seller_id,
        notificationType: 'auction_cancelled_by_admin',
        title: 'Listing Cancelled by Administrator',
        body: `Your listing "${result.title}" was cancelled by a campus administrator.`,
        auctionId: result.id
      });
      await notifyAdmins({
        notificationType: 'auction_moderated',
        title: 'Auction Listing Cancelled',
        body: `The listing "${result.title}" was cancelled by ${req.user.display_name}.`,
        auctionId: result.id,
        excludeUserId: req.user.id
      });
    }

    return res.json({ auction: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/sales', async (req, res) => {
  try {
    const result = await query(
      `SELECT s.id, s.auction_id, s.status, s.final_price, s.failure_reason, s.created_at,
              a.title AS auction_title, seller.display_name AS seller_name,
              buyer.display_name AS buyer_name
       FROM sales s
       JOIN auctions a ON a.id = s.auction_id
       JOIN users seller ON seller.id = s.seller_id
       LEFT JOIN users buyer ON buyer.id = s.buyer_id
       ORDER BY s.created_at DESC LIMIT 100`
    );
    return res.json({ sales: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/sales/:id/status', async (req, res) => {
  if (req.body.status !== 'cancelled') {
    return res.status(400).json({ error: 'Admins may only block an in-progress transaction.' });
  }
  try {
    const result = await transaction(async (tx) => {
      const saleResult = await tx.query(
        `UPDATE sales
         SET status = 'cancelled', failure_reason = 'Blocked by campus administrator', updated_at = NOW()
         WHERE id = $1 AND status IN ('pending_seller_approval', 'reserved')
         RETURNING id, auction_id, status, failure_reason`,
        [req.params.id]
      );
      if (saleResult.rows.length === 0) return null;
      const sale = saleResult.rows[0];
      await tx.query(
        `INSERT INTO auction_events (auction_id, actor_id, event_type, payload)
         VALUES ($1, $2, 'admin_transaction_blocked', $3)`,
        [sale.auction_id, req.user.id, JSON.stringify({ saleId: sale.id, reason: sale.failure_reason })]
      );
      return sale;
    });
    if (!result) return res.status(404).json({ error: 'Only pending or reserved transactions can be blocked.' });
    return res.json({ sale: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
