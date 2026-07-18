// routes/leads.js — CRUD for leads, user-scoped
const express  = require('express');
const mongoose = require('mongoose');
const requireAuth = require('../middleware/auth');
const router   = express.Router();
router.use(requireAuth);

const Lead = () => mongoose.models.Lead;

// GET /api/leads — list with filters
router.get('/', async (req, res, next) => {
  try {
    const { country, status, search, limit = 50, page = 1 } = req.query;
    const query = {};
    if (country && country !== 'all') query.country = country;
    if (status  && status !== 'all')  query.status  = status;
    if (search) query.name = { $regex: search, $options: 'i' };

    const [leads, total] = await Promise.all([
      Lead().find(query).sort({ found_at: -1 }).limit(+limit).skip((+page-1)*+limit),
      Lead().countDocuments(query)
    ]);
    res.json({ leads, total, page: +page });
  } catch (err) { next(err); }
});

// PATCH /api/leads/:id — update status
router.patch('/:id', async (req, res, next) => {
  try {
    const lead = await Lead().findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) { next(err); }
});

// GET /api/leads/stats
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await Lead().aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const mrr = await Lead().aggregate([
      { $match: { status: 'paying' } },
      { $group: { _id: null, total: { $sum: '$mrr' } } }
    ]);
    res.json({ by_status: stats, mrr: mrr[0]?.total || 0 });
  } catch (err) { next(err); }
});

module.exports = router;
