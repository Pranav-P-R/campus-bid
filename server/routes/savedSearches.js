const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/saved-searches
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        ss.*,
        c.name AS category_name
       FROM saved_searches ss
       LEFT JOIN categories c ON ss.category_id = c.id
       WHERE ss.user_id = $1
       ORDER BY ss.created_at DESC`,
      [req.user.id]
    );

    return res.json({ savedSearches: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/saved-searches
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      name,
      keyword,
      categoryId,
      itemCondition,
      minPrice,
      maxPrice,
      priceBasis = 'starting_price'
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Please give your saved search a label (e.g. "Scientific calculator under ₹400").' });
    }

    const minP = minPrice ? parseFloat(minPrice) : null;
    const maxP = maxPrice ? parseFloat(maxPrice) : null;

    if (minP !== null && maxP !== null && minP > maxP) {
      return res.status(400).json({ error: 'Minimum price cannot exceed maximum price.' });
    }

    const result = await query(
      `INSERT INTO saved_searches (
        user_id,
        name,
        keyword,
        category_id,
        item_condition,
        min_price,
        max_price,
        price_basis
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        req.user.id,
        name.trim(),
        keyword?.trim() || null,
        categoryId ? parseInt(categoryId, 10) : null,
        itemCondition || null,
        minP,
        maxP,
        priceBasis
      ]
    );

    return res.status(201).json({
      message: 'Saved search created! You will be alerted whenever a matching item is published.',
      savedSearch: result.rows[0]
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/saved-searches/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM saved_searches WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    return res.json({ message: 'Saved search deleted.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/saved-searches/:id/toggle
router.patch('/:id/toggle', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notificationsOn } = req.body;

    const result = await query(
      `UPDATE saved_searches
       SET notifications_on = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [notificationsOn, id, req.user.id]
    );

    return res.json({ savedSearch: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

