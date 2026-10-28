const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'campus-auction-super-secret-key-2026';

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const result = await query(
      'SELECT id, full_name, display_name, email, campus_id, email_verified, campus_verified, is_admin, account_status FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or account removed.' });
    }

    const user = result.rows[0];
    if (user.account_status !== 'active') {
      return res.status(403).json({ error: 'Account is not active.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const result = await query(
        'SELECT id, full_name, display_name, email, campus_id, email_verified, campus_verified, is_admin, account_status FROM users WHERE id = $1',
        [decoded.userId]
      );
      if (result.rows.length > 0 && result.rows[0].account_status === 'active') {
        req.user = result.rows[0];
      }
    }
  } catch (err) {
    // Optional auth - ignore failures
  }
  next();
}

module.exports = {
  JWT_SECRET,
  requireAuth,
  optionalAuth
};

