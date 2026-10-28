const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { placeBid, setAutoBidLimit } = require('../services/auctionEngine');

// POST /api/auctions/:id/bids (Manual bid placement)
router.post('/:id/bids', requireAuth, async (req, res) => {
  try {
    if (req.user.is_admin || req.user.account_type !== 'buyer') {
      return res.status(403).json({ error: 'Campus administrators cannot participate in auctions.' });
    }
    const { id } = req.params;
    const { amount, requestKey } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Please enter a bid amount.' });
    }

    const result = await placeBid({
      auctionId: id,
      bidderId: req.user.id,
      amount,
      bidType: 'manual',
      requestKey
    });

    return res.status(201).json({
      message: result.wasExtended
        ? 'Bid accepted! Deadline extended by 60s due to anti-sniping rule.'
        : 'Bid placed successfully!',
      ...result
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/auctions/:id/bids (Public bid history)
router.get('/:id/bids', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT
        b.id,
        b.amount,
        b.bid_type,
        b.created_at,
        u.display_name AS bidder_display_name,
        b.bidder_id = $2 AS is_my_bid
       FROM bids b
       JOIN users u ON b.bidder_id = u.id
       WHERE b.auction_id = $1
       ORDER BY b.amount DESC, b.created_at ASC`,
      [id, req.user?.id || null]
    );

    return res.json({ bids: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/auctions/:id/auto-bid (Configure automatic proxy bidding)
router.put('/:id/auto-bid', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { maximumAmount } = req.body;

    if (!maximumAmount) {
      return res.status(400).json({ error: 'Please specify your maximum auto-bid ceiling.' });
    }

    const autoBid = await setAutoBidLimit({
      auctionId: id,
      userId: req.user.id,
      maximumAmount
    });

    return res.json({
      message: `Automatic bidding active up to ₹${parseFloat(maximumAmount).toFixed(2)}. The system will automatically maintain your lead!`,
      autoBid
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// DELETE /api/auctions/:id/auto-bid (Deactivate auto-bid limit)
router.delete('/:id/auto-bid', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      `UPDATE auto_bid_limits
       SET is_active = FALSE, updated_at = NOW()
       WHERE auction_id = $1 AND bidder_id = $2`,
      [id, req.user.id]
    );
    return res.json({ message: 'Automatic bidding cancelled for this item.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
