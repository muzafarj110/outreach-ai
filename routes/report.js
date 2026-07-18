// routes/report.js
const express  = require('express');
const requireAuth = require('../middleware/auth');
const { runReportAgent } = require('../agents/report');
const router   = express.Router();
router.use(requireAuth);

router.post('/send', async (req, res, next) => {
  try {
    await runReportAgent();
    res.json({ message: 'Report sent to WhatsApp' });
  } catch (err) { next(err); }
});

module.exports = router;
