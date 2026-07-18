// ═══════════════════════════════════════════════════
// routes/auth.js — Login & Register
// ═══════════════════════════════════════════════════

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const mongoose = require('mongoose');
const router   = express.Router();

// User model (inline for simplicity)
const UserSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true, select: false },
  plan:      { type: String, enum: ['starter','growth','pro'], default: 'starter' },
  countries: { type: [String], default: [] },
  wa_number: { type: String },         // their WhatsApp for reports
  created:   { type: Date, default: Date.now },
  active:    { type: Boolean, default: true },
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.model('User', UserSchema);

function signToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, wa_number } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email, and password required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = await User.create({ name, email, password, wa_number });
    const token = signToken(user);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan }
    });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.active) return res.status(403).json({ error: 'Account suspended' });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, plan: user.plan, countries: user.countries }
    });
  } catch (err) { next(err); }
});

// GET /api/auth/me — verify token and return user
router.get('/me', require('../middleware/auth'), async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, name: user.name, email: user.email, plan: user.plan, countries: user.countries });
  } catch (err) { next(err); }
});

module.exports = router;
