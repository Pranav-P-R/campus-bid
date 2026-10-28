const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { optionalAuth } = require('../middleware/auth');

// POST /api/assistant/query
router.post('/query', optionalAuth, async (req, res) => {
  try {
    const { queryText, currentAuctionId } = req.body;

    if (!queryText || !queryText.trim()) {
      return res.status(400).json({ error: 'Please ask a question or specify what you are looking for.' });
    }

    const text = queryText.toLowerCase().trim();

    // 1. Detect Category & Keywords
    let detectedKeyword = null;
    let detectedCategoryId = null;

    if (text.includes('cycle') || text.includes('bicycle') || text.includes('bike')) {
      detectedKeyword = 'cycle';
      detectedCategoryId = 1; // Cycles
    } else if (text.includes('calc') || text.includes('calculator') || text.includes('casio')) {
      detectedKeyword = 'calculator';
      detectedCategoryId = 2; // Calculators
    } else if (text.includes('book') || text.includes('textbook') || text.includes('notes')) {
      detectedKeyword = 'book';
      detectedCategoryId = 3; // Books
    } else if (text.includes('electron') || text.includes('monitor') || text.includes('charger') || text.includes('keyboard') || text.includes('mouse')) {
      detectedKeyword = 'electronics';
      detectedCategoryId = 4; // Electronics
    } else if (text.includes('hostel') || text.includes('fridge') || text.includes('kettle') || text.includes('mattress') || text.includes('bucket') || text.includes('lamp')) {
      detectedKeyword = 'hostel';
      detectedCategoryId = 5; // Hostel Items
    }

    // 2. Extract Price limits (e.g. "under 1500", "below ₹2000", "< 500", "max 1000")
    let maxPrice = null;
    const priceMatch = text.match(/(?:under|below|less than|max|budget of?|upto|up to|₹|\$)\s*(\d+(?:\.\d+)?)/i) ||
                       text.match(/(\d+(?:\.\d+)?)\s*(?:rs|rupees|inr|bucks)/i);
    if (priceMatch) {
      maxPrice = parseFloat(priceMatch[1]);
    }

    // 3. Extract Condition
    let condition = null;
    if (text.includes('like new') || text.includes('mint')) {
      condition = 'like_new';
    } else if (text.includes('brand new') || text.includes('unopened')) {
      condition = 'new';
    } else if (text.includes('good')) {
      condition = 'good';
    }

    // 4. Determine intent
    const isSpecificBidAdvice = currentAuctionId || text.includes('should i bid') || text.includes('how much to bid') || text.includes('bid on this');
    const isComparison = text.includes('compare') || text.includes('difference') || text.includes('which one');

    let matchingAuctions = [];
    let reply = '';
    let proposedAction = null;

    if (isSpecificBidAdvice && currentAuctionId) {
      // Analyze current auction
      const aucRes = await query(
        `SELECT a.*, c.name AS category_name,
                (SELECT COUNT(*)::int FROM bids WHERE auction_id = a.id) AS bid_count
         FROM auctions a
         JOIN categories c ON a.category_id = c.id
         WHERE a.id = $1`,
        [currentAuctionId]
      );

      if (aucRes.rows.length > 0) {
        const item = aucRes.rows[0];
        const currentP = item.current_price ? parseFloat(item.current_price) : parseFloat(item.starting_price);
        const minInc = parseFloat(item.min_bid_increment);
        const nextMinBid = item.current_price ? currentP + minInc : currentP;

        // Smart recommendation
        const recommendedSafeBid = nextMinBid;
        const recommendedAutoCeiling = Math.round(nextMinBid + minInc * 3);

        reply = `For **"${item.title}"**, the current leading price is **₹${currentP.toFixed(2)}** with ${item.bid_count} bid(s) placed. ` +
                `The minimum valid next bid is **₹${nextMinBid.toFixed(2)}**. ` +
                `If you want to secure this item without constantly checking your screen, I suggest setting an automatic proxy bid with a ceiling of **₹${recommendedAutoCeiling.toFixed(2)}**. ` +
                `Would you like to approve placing the next bid or setting the auto-bid ceiling?`;

        proposedAction = {
          type: 'place_bid',
          auctionId: item.id,
          auctionTitle: item.title,
          proposedAmount: recommendedSafeBid,
          suggestedAutoCeiling: recommendedAutoCeiling,
          reason: `Minimum required bid is ₹${nextMinBid.toFixed(2)} (Increment: ₹${minInc.toFixed(2)})`
        };

        matchingAuctions = [item];
      }
    } else if (isComparison && detectedCategoryId) {
      // Compare items in category
      const res = await query(
        `SELECT a.id, a.title, a.item_condition, a.starting_price, a.current_price, a.end_time,
                (SELECT image_url FROM auction_images WHERE auction_id = a.id ORDER BY sort_order ASC LIMIT 1) AS image_url,
                (SELECT COUNT(*)::int FROM bids WHERE auction_id = a.id) AS bid_count
         FROM auctions a
         WHERE a.category_id = $1 AND a.status = 'active' AND a.end_time > NOW()
         ORDER BY COALESCE(a.current_price, a.starting_price) ASC
         LIMIT 4`,
        [detectedCategoryId]
      );
      matchingAuctions = res.rows;

      if (matchingAuctions.length > 1) {
        reply = `Here is a side-by-side comparison of ${matchingAuctions.length} active listings in this category. ` +
                `The lowest entry price is **"${matchingAuctions[0].title}"** at ₹${parseFloat(matchingAuctions[0].current_price || matchingAuctions[0].starting_price).toFixed(2)} (${matchingAuctions[0].item_condition} condition). ` +
                `Notice the closing times and bid activity below to gauge demand!`;
      } else {
        reply = `Found ${matchingAuctions.length} item matching your criteria.`;
      }
    } else {
      // General search query
      let conditions = [`a.status = 'active' AND a.end_time > NOW()`];
      let params = [];
      let pIdx = 1;

      if (detectedCategoryId) {
        conditions.push(`a.category_id = $${pIdx++}`);
        params.push(detectedCategoryId);
      }
      if (condition) {
        conditions.push(`a.item_condition = $${pIdx++}`);
        params.push(condition);
      }
      if (maxPrice) {
        conditions.push(`COALESCE(a.current_price, a.starting_price) <= $${pIdx++}`);
        params.push(maxPrice);
      }
      if (!detectedCategoryId && text.length > 2) {
        conditions.push(`(a.title ILIKE $${pIdx} OR a.description ILIKE $${pIdx})`);
        params.push(`%${text}%`);
        pIdx++;
      }

      const res = await query(
        `SELECT a.id, a.title, a.description, a.item_condition, a.starting_price, a.current_price,
                a.min_bid_increment, a.end_time, c.name AS category_name,
                (SELECT image_url FROM auction_images WHERE auction_id = a.id ORDER BY sort_order ASC LIMIT 1) AS image_url,
                (SELECT COUNT(*)::int FROM bids WHERE auction_id = a.id) AS bid_count
         FROM auctions a
         JOIN categories c ON a.category_id = c.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY a.end_time ASC
         LIMIT 6`,
        params
      );

      matchingAuctions = res.rows;

      if (matchingAuctions.length > 0) {
        const topItem = matchingAuctions[0];
        const topPrice = topItem.current_price ? parseFloat(topItem.current_price) : parseFloat(topItem.starting_price);
        const nextBid = topItem.current_price ? topPrice + parseFloat(topItem.min_bid_increment) : topPrice;

        reply = `I found **${matchingAuctions.length} listing(s)** on campus matching your request${maxPrice ? ` under ₹${maxPrice}` : ''}! ` +
                `The top match is **"${topItem.title}"** currently at **₹${topPrice.toFixed(2)}** (${topItem.item_condition.replace('_', ' ')}). ` +
                `Would you like to inspect it or propose a bid?`;

        proposedAction = {
          type: 'place_bid',
          auctionId: topItem.id,
          auctionTitle: topItem.title,
          proposedAmount: nextBid,
          reason: `Top matching item. Next valid bid amount is ₹${nextBid.toFixed(2)}.`
        };
      } else {
        reply = `I couldn't find active auctions matching "${queryText}". Try broadening your search or creating a **Saved Search Alert** so you get notified the instant a classmate lists one!`;
      }
    }

    return res.json({
      reply,
      detectedFilters: {
        keyword: detectedKeyword,
        categoryId: detectedCategoryId,
        maxPrice,
        condition
      },
      matchingAuctions,
      proposedAction
    });
  } catch (err) {
    console.error('Assistant error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

