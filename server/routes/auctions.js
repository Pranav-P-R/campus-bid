const express = require('express');
const router = express.Router();
const { query, transaction } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const {
  createNotification,
  notifyAdmins,
  notifySavedSearchMatch
} = require('../services/notificationService');

let ioInstance = null;
function setSocketIo(io) {
  ioInstance = io;
}

// GET /api/auctions/categories
router.get('/categories', async (req, res) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY name ASC');
    return res.json({ categories: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/auctions
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      q,
      categoryId,
      condition,
      minPrice,
      maxPrice,
      status = 'active',
      sellerId,
      bidderId,
      sortBy = 'closing_soon'
    } = req.query;

    let conditions = [];
    let params = [];
    let pIdx = 1;

    // Status filter
    if (status === 'active') {
      conditions.push(`a.status = 'active' AND a.end_time > NOW()`);
    } else if (status === 'closed') {
      conditions.push(`(a.status = 'closed' OR a.end_time <= NOW())`);
    } else if (status === 'cancelled') {
      conditions.push(`a.status = 'cancelled'`);
    } else if (status !== 'all') {
      conditions.push(`a.status = $${pIdx++}`);
      params.push(status);
    }

    // Keyword search
    if (q && q.trim()) {
      conditions.push(`(a.title ILIKE $${pIdx} OR a.description ILIKE $${pIdx})`);
      params.push(`%${q.trim()}%`);
      pIdx++;
    }

    // Category filter
    if (categoryId) {
      conditions.push(`a.category_id = $${pIdx++}`);
      params.push(parseInt(categoryId, 10));
    }

    // Condition filter
    if (condition) {
      const condList = condition.split(',').map(c => c.trim());
      conditions.push(`a.item_condition = ANY($${pIdx++})`);
      params.push(condList);
    }

    // Price range filters
    if (minPrice) {
      conditions.push(`COALESCE(a.current_price, a.starting_price) >= $${pIdx++}`);
      params.push(parseFloat(minPrice));
    }
    if (maxPrice) {
      conditions.push(`COALESCE(a.current_price, a.starting_price) <= $${pIdx++}`);
      params.push(parseFloat(maxPrice));
    }

    // Seller filter
    if (sellerId) {
      conditions.push(`a.seller_id = $${pIdx++}`);
      params.push(sellerId);
    }

    // Bidder filter
    if (bidderId) {
      conditions.push(`EXISTS (SELECT 1 FROM bids b WHERE b.auction_id = a.id AND b.bidder_id = $${pIdx++})`);
      params.push(bidderId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sorting
    let orderBy = 'a.end_time ASC';
    if (sortBy === 'newest') {
      orderBy = 'a.created_at DESC';
    } else if (sortBy === 'price_asc') {
      orderBy = 'COALESCE(a.current_price, a.starting_price) ASC';
    } else if (sortBy === 'price_desc') {
      orderBy = 'COALESCE(a.current_price, a.starting_price) DESC';
    } else if (sortBy === 'bids_desc') {
      orderBy = 'bid_count DESC, a.end_time ASC';
    } else if (sortBy === 'closing_soon') {
      orderBy = 'a.end_time ASC';
    }

    const sql = `
      SELECT
        a.id,
        a.seller_id,
        a.category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        a.title,
        a.description,
        a.item_condition,
        a.starting_price,
        a.min_bid_increment,
        a.current_price,
        a.current_high_bidder_id,
        a.start_time,
        a.end_time,
        a.status,
        a.cancellation_reason,
        a.closed_at,
        a.created_at,
        u.display_name AS seller_display_name,
        u.campus_verified AS seller_verified,
        hb.display_name AS leading_bidder_name,
        (SELECT COUNT(*)::int FROM bids WHERE auction_id = a.id) AS bid_count,
        COALESCE(
          (SELECT json_agg(image_url ORDER BY sort_order ASC)
           FROM auction_images
           WHERE auction_id = a.id),
          '[]'::json
        ) AS images
      FROM auctions a
      JOIN categories c ON a.category_id = c.id
      JOIN users u ON a.seller_id = u.id
      LEFT JOIN users hb ON a.current_high_bidder_id = hb.id
      ${whereClause}
      ORDER BY ${orderBy}
    `;

    const result = await query(sql, params);
    return res.json({ auctions: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Error fetching auctions:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/auctions/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const auctionRes = await query(
      `SELECT
        a.id,
        a.seller_id,
        a.category_id,
        c.name AS category_name,
        c.slug AS category_slug,
        a.title,
        a.description,
        a.item_condition,
        a.starting_price,
        a.min_bid_increment,
        a.current_price,
        a.current_high_bidder_id,
        a.start_time,
        a.end_time,
        a.status,
        a.cancellation_reason,
        a.closed_at,
        a.created_at,
        u.display_name AS seller_display_name,
        u.campus_verified AS seller_verified,
        hb.display_name AS leading_bidder_name,
        (SELECT COUNT(*)::int FROM bids WHERE auction_id = a.id) AS bid_count,
        COALESCE(
          (SELECT json_agg(image_url ORDER BY sort_order ASC)
           FROM auction_images
           WHERE auction_id = a.id),
          '[]'::json
        ) AS images
       FROM auctions a
       JOIN categories c ON a.category_id = c.id
       JOIN users u ON a.seller_id = u.id
       LEFT JOIN users hb ON a.current_high_bidder_id = hb.id
       WHERE a.id = $1`,
      [id]
    );

    if (auctionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const auction = auctionRes.rows[0];

    // Public bid history - displays public display name only! Never email or student ID.
    const bidsRes = await query(
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

    // Q&A
    const questionsRes = await query(
      `SELECT
        q.id,
        q.question_text,
        q.answer_text,
        q.answered_at,
        q.visibility,
        q.created_at,
        asker.display_name AS asker_name,
        answerer.display_name AS answerer_name,
        q.asker_id = $2 AS is_my_question
       FROM questions q
       JOIN users asker ON q.asker_id = asker.id
       LEFT JOIN users answerer ON q.answered_by_user_id = answerer.id
       WHERE q.auction_id = $1 AND (q.visibility = 'visible' OR q.asker_id = $2 OR $3 = TRUE)
       ORDER BY q.created_at DESC`,
      [id, req.user?.id || null, req.user?.id === auction.seller_id || req.user?.is_admin || false]
    );

    // Sale record if auction closed or in progress
    const saleRes = await query(
      `SELECT
        s.id,
        s.status,
        s.final_price,
        s.seller_decided_at,
        s.reserved_at,
        s.completed_at,
        s.failure_reason,
        s.outcome_notes,
        s.buyer_id,
        s.seller_id,
        b.display_name AS buyer_name,
        sel.display_name AS seller_name
       FROM sales s
       LEFT JOIN users b ON s.buyer_id = b.id
       LEFT JOIN users sel ON s.seller_id = sel.id
       WHERE s.auction_id = $1`,
      [id]
    );

    // User's auto-bid limit (if logged in)
    let myAutoBid = null;
    if (req.user) {
      const autoRes = await query(
        `SELECT maximum_amount, is_active FROM auto_bid_limits WHERE auction_id = $1 AND bidder_id = $2`,
        [id, req.user.id]
      );
      if (autoRes.rows.length > 0) {
        myAutoBid = autoRes.rows[0];
      }
    }

    return res.json({
      auction,
      bids: bidsRes.rows,
      questions: questionsRes.rows,
      sale: saleRes.rows[0] || null,
      myAutoBid,
      isSeller: req.user ? req.user.id === auction.seller_id : false,
      isLeadingBidder: req.user ? req.user.id === auction.current_high_bidder_id : false
    });
  } catch (err) {
    console.error('Error fetching auction details:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auctions (Publish new listing)
router.post('/', requireAuth, async (req, res) => {
  try {
    if (req.user.is_admin || req.user.account_type !== 'seller') {
      return res.status(403).json({ error: 'Campus administrators cannot create auction listings.' });
    }
    const {
      title,
      categoryId,
      description,
      itemCondition,
      startingPrice,
      minBidIncrement,
      durationHours = 24,
      endTime,
      images = []
    } = req.body;

    // Validation
    if (!title || !categoryId || !description || !itemCondition || !startingPrice || !minBidIncrement) {
      return res.status(400).json({ error: 'All item details, starting price, and increment are required.' });
    }

    const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
    if (!validConditions.includes(itemCondition)) {
      return res.status(400).json({ error: `Invalid item condition. Must be one of: ${validConditions.join(', ')}` });
    }

    const numStart = parseFloat(startingPrice);
    const numInc = parseFloat(minBidIncrement);
    if (isNaN(numStart) || numStart <= 0) {
      return res.status(400).json({ error: 'Starting price must be a positive number.' });
    }
    if (isNaN(numInc) || numInc <= 0) {
      return res.status(400).json({ error: 'Minimum bid increment must be a positive number.' });
    }

    let calculatedEndTime;
    if (endTime) {
      calculatedEndTime = new Date(endTime);
      if (calculatedEndTime <= new Date()) {
        return res.status(400).json({ error: 'Closing date/time must be in the future.' });
      }
    } else {
      calculatedEndTime = new Date(Date.now() + Math.max(1, parseFloat(durationHours)) * 3600000);
    }

    let newAuction = null;

    await transaction(async (tx) => {
      const aucRes = await tx.query(
        `INSERT INTO auctions (
          seller_id,
          category_id,
          title,
          description,
          item_condition,
          starting_price,
          min_bid_increment,
          end_time,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
        RETURNING *`,
        [
          req.user.id,
          parseInt(categoryId, 10),
          title.trim(),
          description.trim(),
          itemCondition,
          numStart,
          numInc,
          calculatedEndTime
        ]
      );

      newAuction = aucRes.rows[0];

      // Insert photos
      if (Array.isArray(images) && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const imgUrl = images[i];
          if (imgUrl && typeof imgUrl === 'string') {
            await tx.query(
              `INSERT INTO auction_images (auction_id, image_url, sort_order)
               VALUES ($1, $2, $3)`,
              [newAuction.id, imgUrl.trim(), i]
            );
          }
        }
      }

      // Record published event in audit trail
      await tx.query(
        `INSERT INTO auction_events (auction_id, actor_id, event_type, payload)
         VALUES ($1, $2, 'auction_published', $3)`,
        [
          newAuction.id,
          req.user.id,
          JSON.stringify({
            title: newAuction.title,
            starting_price: numStart,
            min_increment: numInc,
            end_time: calculatedEndTime
          })
        ]
      );
    });

    // Check saved searches and trigger alerts!
    matchSavedSearches(newAuction).catch(err => {
      console.error('Error matching saved searches:', err);
    });
    notifyAdmins({
      notificationType: 'new_auction_for_review',
      title: 'New Auction Listing Published',
      body: `${req.user.display_name} published "${newAuction.title}" for campus review.`,
      auctionId: newAuction.id
    }).catch(err => {
      console.error('Error notifying administrators about new auction:', err);
    });

    if (ioInstance) {
      ioInstance.emit('new_auction_published', {
        id: newAuction.id,
        title: newAuction.title,
        starting_price: newAuction.starting_price,
        end_time: newAuction.end_time
      });
    }

    return res.status(201).json({
      message: 'Auction published successfully!',
      auction: newAuction
    });
  } catch (err) {
    console.error('Error creating auction:', err);
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auctions/:id (Edit listing)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, itemCondition, images } = req.body;

    const aucRes = await query('SELECT * FROM auctions WHERE id = $1', [id]);
    if (aucRes.rows.length === 0) return res.status(404).json({ error: 'Auction not found' });
    const auction = aucRes.rows[0];

    if (auction.seller_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Only the seller can edit this auction.' });
    }

    if (auction.status !== 'active') {
      return res.status(400).json({ error: `Cannot edit an auction that is ${auction.status}.` });
    }

    const updatedTitle = title !== undefined ? title.trim() : auction.title;
    const updatedDesc = description !== undefined ? description.trim() : auction.description;
    const updatedCond = itemCondition !== undefined ? itemCondition : auction.item_condition;

    const result = await query(
      `UPDATE auctions
       SET title = $1, description = $2, item_condition = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [updatedTitle, updatedDesc, updatedCond, id]
    );

    // Update images if provided
    if (Array.isArray(images) && images.length > 0) {
      await query('DELETE FROM auction_images WHERE auction_id = $1', [id]);
      for (let i = 0; i < images.length; i++) {
        if (images[i] && typeof images[i] === 'string') {
          await query(
            'INSERT INTO auction_images (auction_id, image_url, sort_order) VALUES ($1, $2, $3)',
            [id, images[i].trim(), i]
          );
        }
      }
    }

    // Record audit event
    await query(
      `INSERT INTO auction_events (auction_id, actor_id, event_type, payload)
       VALUES ($1, $2, 'listing_edited', $3)`,
      [
        id,
        req.user.id,
        JSON.stringify({
          updated_title: updatedTitle,
          updated_condition: updatedCond,
          updated_photos_count: Array.isArray(images) ? images.length : undefined
        })
      ]
    );

    // Fetch updated images
    const freshImagesRes = await query(
      `SELECT image_url FROM auction_images WHERE auction_id = $1 ORDER BY sort_order ASC`,
      [id]
    );
    const freshImages = freshImagesRes.rows.map(r => r.image_url);

    if (ioInstance) {
      ioInstance.to(`auction:${id}`).emit('auction_update', {
        auctionId: id,
        title: updatedTitle,
        description: updatedDesc,
        item_condition: updatedCond,
        images: freshImages
      });
      ioInstance.emit('global_auction_update', {
        auctionId: id,
        title: updatedTitle
      });
    }

    return res.json({
      message: 'Listing updated successfully.',
      auction: { ...result.rows[0], images: freshImages }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auctions/:id/cancel (Cancel listing - preserving history)
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by seller' } = req.body;

    let cancelledAuction = null;

    await transaction(async (tx) => {
      const aucRes = await tx.query('SELECT * FROM auctions WHERE id = $1 FOR UPDATE', [id]);
      if (aucRes.rows.length === 0) throw new Error('Auction not found');
      const auction = aucRes.rows[0];

      if (auction.seller_id !== req.user.id && !req.user.is_admin) {
        throw new Error('Only the seller can cancel this auction.');
      }

      if (auction.status === 'cancelled' || auction.status === 'closed') {
        throw new Error(`Cannot cancel auction that is already ${auction.status}.`);
      }

      // Mark cancelled, record reason
      const updateRes = await tx.query(
        `UPDATE auctions
         SET status = 'cancelled', cancellation_reason = $1, closed_at = NOW(), updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [reason, id]
      );
      cancelledAuction = updateRes.rows[0];

      // Record in sales outcome table
      await tx.query(
        `INSERT INTO sales (auction_id, seller_id, status, failure_reason, outcome_notes)
         VALUES ($1, $2, 'cancelled', $3, 'Cancelled by seller prior to completion')
         ON CONFLICT (auction_id)
         DO UPDATE SET status = 'cancelled', failure_reason = $3, updated_at = NOW()`,
        [id, auction.seller_id, reason]
      );

      // Record in auction_events audit trail
      await tx.query(
        `INSERT INTO auction_events (auction_id, actor_id, event_type, payload, is_public)
         VALUES ($1, $2, 'auction_cancelled', $3, TRUE)`,
        [id, req.user.id, JSON.stringify({ reason })]
      );
    });

    if (ioInstance) {
      ioInstance.to(`auction:${id}`).emit('auction_cancelled', { auctionId: id, reason });
      ioInstance.emit('global_auction_update', { auctionId: id, status: 'cancelled' });
    }

    const bidderRes = await query(
      `SELECT DISTINCT bidder_id
       FROM bids
       WHERE auction_id = $1 AND bidder_id <> $2`,
      [id, req.user.id]
    );
    await Promise.all(bidderRes.rows.map((bidder) => createNotification({
      userId: bidder.bidder_id,
      notificationType: 'auction_cancelled',
      title: 'Auction Cancelled',
      body: `The auction "${cancelledAuction.title}" was cancelled. Reason: ${reason}`,
      auctionId: id
    })));
    await notifyAdmins({
      notificationType: 'auction_cancelled',
      title: 'Auction Cancelled',
      body: `The listing "${cancelledAuction.title}" was cancelled by ${req.user.display_name}.`,
      auctionId: id,
      excludeUserId: req.user.is_admin ? req.user.id : null
    });

    return res.json({ message: 'Auction cancelled successfully.', auction: cancelledAuction });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * Helper to match newly published auctions against active saved searches
 */
async function matchSavedSearches(auction) {
  const matchesRes = await query(
    `SELECT ss.*, u.email
     FROM saved_searches ss
     JOIN users u ON ss.user_id = u.id
     WHERE ss.is_active = TRUE
       AND ss.notifications_on = TRUE
       AND ss.user_id != $1
       AND (ss.category_id IS NULL OR ss.category_id = $2)
       AND (ss.item_condition IS NULL OR ss.item_condition = $3)
       AND (ss.min_price IS NULL OR $4 >= ss.min_price)
       AND (ss.max_price IS NULL OR $4 <= ss.max_price)
       AND (ss.keyword IS NULL OR $5 ILIKE ('%' || ss.keyword || '%') OR $6 ILIKE ('%' || ss.keyword || '%'))`,
    [
      auction.seller_id,
      auction.category_id,
      auction.item_condition,
      parseFloat(auction.starting_price),
      auction.title,
      auction.description
    ]
  );

  for (const match of matchesRes.rows) {
    await notifySavedSearchMatch({
      userId: match.user_id,
      auctionId: auction.id,
      auctionTitle: auction.title,
      startingPrice: auction.starting_price,
      searchName: match.name
    });
  }
}

module.exports = {
  router,
  setSocketIo
};
