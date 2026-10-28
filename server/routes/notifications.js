const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    const unreadCountRes = await query(
      `SELECT COUNT(*)::int AS unread_count
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id]
    );

    return res.json({
      notifications: result.rows,
      unreadCount: unreadCountRes.rows[0]?.unread_count || 0
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/mark-read
router.post('/mark-read', requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.body;

    if (notificationId) {
      await query(
        `UPDATE notifications
         SET read_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [notificationId, req.user.id]
      );
    } else {
      // Mark all read
      await query(
        `UPDATE notifications
         SET read_at = NOW()
         WHERE user_id = $1 AND read_at IS NULL`,
        [req.user.id]
      );
    }

    return res.json({ message: 'Marked as read' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/push-subscriptions (Save browser push registration)
router.post('/push-subscriptions', requireAuth, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid push subscription details' });
    }

    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, last_used_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (endpoint)
       DO UPDATE SET user_id = $1, p256dh_key = $3, auth_key = $4, last_used_at = NOW()`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );

    return res.status(201).json({ message: 'Push notifications enabled.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

