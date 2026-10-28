const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAdmin } = require('../middleware/auth');

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
    const result = await query(
      `UPDATE auctions SET status = $1, cancellation_reason = CASE WHEN $1 = 'cancelled' THEN 'Cancelled by campus administrator' ELSE NULL END,
       updated_at = NOW() WHERE id = $2 RETURNING id, status`,
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Auction not found.' });
    return res.json({ auction: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
