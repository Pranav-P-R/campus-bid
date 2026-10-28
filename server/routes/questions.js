const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

let ioInstance = null;
function setSocketIo(io) {
  ioInstance = io;
}

// POST /api/auctions/:id/questions (Ask question)
router.post('/:id/questions', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { questionText } = req.body;

    if (!questionText || !questionText.trim()) {
      return res.status(400).json({ error: 'Question text is required.' });
    }

    if (questionText.trim().length > 1000) {
      return res.status(400).json({ error: 'Question must be under 1,000 characters.' });
    }

    // Verify auction exists
    const aucRes = await query('SELECT title, seller_id FROM auctions WHERE id = $1', [id]);
    if (aucRes.rows.length === 0) return res.status(404).json({ error: 'Auction not found' });
    const auction = aucRes.rows[0];

    const insertRes = await query(
      `INSERT INTO questions (auction_id, asker_id, question_text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, req.user.id, questionText.trim()]
    );

    const question = insertRes.rows[0];

    // Notify seller
    createNotification({
      userId: auction.seller_id,
      notificationType: 'new_question',
      title: 'New Question on Your Item 💬',
      body: `${req.user.display_name} asked: "${questionText.trim()}" on "${auction.title}".`,
      auctionId: id
    }).catch(err => console.error(err));

    if (ioInstance) {
      ioInstance.to(`auction:${id}`).emit('new_question', {
        ...question,
        asker_name: req.user.display_name
      });
    }

    return res.status(201).json({
      message: 'Question posted! The seller has been notified.',
      question: {
        ...question,
        asker_name: req.user.display_name
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auctions/:id/questions/:qId/answer (Seller answer)
router.post('/:id/questions/:qId/answer', requireAuth, async (req, res) => {
  try {
    const { id, qId } = req.params;
    const { answerText } = req.body;

    if (!answerText || !answerText.trim()) {
      return res.status(400).json({ error: 'Answer text is required.' });
    }

    const aucRes = await query('SELECT title, seller_id FROM auctions WHERE id = $1', [id]);
    if (aucRes.rows.length === 0) return res.status(404).json({ error: 'Auction not found' });
    const auction = aucRes.rows[0];

    if (auction.seller_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Only the seller can answer questions on this listing.' });
    }

    const qRes = await query('SELECT * FROM questions WHERE id = $1 AND auction_id = $2', [qId, id]);
    if (qRes.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    const originalQuestion = qRes.rows[0];

    const updateRes = await query(
      `UPDATE questions
       SET answer_text = $1,
           answered_by_user_id = $2,
           answered_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [answerText.trim(), req.user.id, qId]
    );

    const answered = updateRes.rows[0];

    // Notify asker
    createNotification({
      userId: originalQuestion.asker_id,
      notificationType: 'question_answered',
      title: 'Question Answered! 💬',
      body: `The seller answered your question on "${auction.title}": "${answerText.trim()}"`,
      auctionId: id
    }).catch(err => console.error(err));

    if (ioInstance) {
      ioInstance.to(`auction:${id}`).emit('question_answered', {
        ...answered,
        answerer_name: req.user.display_name
      });
    }

    return res.json({
      message: 'Answer published.',
      question: answered
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auctions/:id/questions/:qId/moderation (Hide/moderate question)
router.patch('/:id/questions/:qId/moderation', requireAuth, async (req, res) => {
  try {
    const { id, qId } = req.params;
    const { visibility } = req.body; // 'visible', 'hidden', 'pending_review'

    if (!['visible', 'hidden', 'pending_review'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility status' });
    }

    const aucRes = await query('SELECT seller_id FROM auctions WHERE id = $1', [id]);
    if (aucRes.rows.length === 0) return res.status(404).json({ error: 'Auction not found' });

    if (aucRes.rows[0].seller_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Unauthorized to moderate this question' });
    }

    await query(
      `UPDATE questions
       SET visibility = $1, updated_at = NOW()
       WHERE id = $2 AND auction_id = $3`,
      [visibility, qId, id]
    );

    return res.json({ message: `Question visibility set to ${visibility}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = {
  router,
  setSocketIo
};

