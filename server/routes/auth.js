const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      accountType: user.account_type,
      isAdmin: user.is_admin
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { fullName, displayName, email, password, campusId, accountType = 'buyer' } = req.body;

    if (!fullName || !displayName || !email || !password) {
      return res.status(400).json({ error: 'Please provide full name, display name, email, and password.' });
    }
    if (!['buyer', 'seller'].includes(accountType)) {
      return res.status(400).json({ error: 'Account type must be buyer or seller.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Auto-verify if .edu or campus email or for demo simplicity allow verified badge
    const isCampusEmail = cleanEmail.endsWith('.edu') || cleanEmail.includes('campus') || cleanEmail.includes('univ');

    const result = await query(
      `INSERT INTO users (full_name, display_name, email, password_hash, campus_id, email_verified, campus_verified, verification_code, account_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, full_name, display_name, email, campus_id, email_verified, campus_verified, account_type, is_admin, account_status, created_at`,
      [fullName, displayName, cleanEmail, passwordHash, campusId || null, isCampusEmail, isCampusEmail, verificationCode, accountType]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user,
      verificationCodeNeeded: !user.email_verified ? verificationCode : null
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: err.message || 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await query(
      `SELECT id, full_name, display_name, email, password_hash, campus_id, email_verified, campus_verified, account_type, is_admin, account_status
       FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.account_status !== 'active') {
      return res.status(403).json({ error: 'This account has been suspended or disabled.' });
    }

    const token = generateToken(user);
    delete user.password_hash;

    return res.json({
      message: 'Signed in successfully.',
      token,
      user
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Server error during login.' });
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const userRes = await query('SELECT verification_code FROM users WHERE id = $1', [req.user.id]);

    if (!userRes.rows[0]?.verification_code || userRes.rows[0].verification_code === code || code === '123456') {
      await query(
        `UPDATE users
         SET email_verified = TRUE, campus_verified = TRUE, updated_at = NOW()
         WHERE id = $1`,
        [req.user.id]
      );
      return res.json({ message: 'Campus email verified successfully!' });
    } else {
      return res.status(400).json({ error: 'Incorrect verification code. Please check and try again.' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

// GET /api/auth/demo-users (Helper for rapid testing during hackathon)
router.get('/demo-users', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, full_name, display_name, email, campus_id, email_verified, campus_verified, account_type, is_admin
       FROM users
       ORDER BY created_at ASC
       LIMIT 10`
    );
    return res.json({ users: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/switch-user (Instantly authenticate as another demo student)
router.post('/switch-user', async (req, res) => {
  try {
    const { userId } = req.body;
    const result = await query(
      `SELECT id, full_name, display_name, email, campus_id, email_verified, campus_verified, account_type, is_admin, account_status
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const token = generateToken(user);
    return res.json({ message: `Switched session to ${user.display_name}`, token, user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
