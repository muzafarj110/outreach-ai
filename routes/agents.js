// routes/agents.js — manually trigger agents from dashboard
const express  = require('express');
const requireAuth = require('../middleware/auth');
const router   = express.Router();
router.use(requireAuth);

const { runResearchAgent }  = require('../agents/research');
const { runContentAgent }   = require('../agents/content');
const { runOutreachAgent }  = require('../agents/outreach');
const { runReportAgent }    = require('../agents/report');

const AGENTS = { research: runResearchAgent, content: runContentAgent, outreach: runOutreachAgent, report: runReportAgent };

// POST /api/agents/:name/run — trigger agent manually
router.post('/:name/run', async (req, res, next) => {
  const run = AGENTS[req.params.name];
  if (!run) return res.status(404).json({ error: 'Unknown agent' });

  // Don't await — fire and respond immediately
  run().catch(e => console.error(`Manual ${req.params.name} run error:`, e));
  res.json({ message: `${req.params.name} agent started`, time: new Date().toISOString() });
});

// GET /api/agents/status
router.get('/status', (req, res) => {
  res.json({
    research:  { schedule: '06:00 Gulf', last_run: null },
    content:   { schedule: '06:30 Gulf', last_run: null },
    outreach:  { schedule: '09:00 Gulf (Mon-Fri)', last_run: null },
    report:    { schedule: '07:00 Gulf', last_run: null },
    publisher: { schedule: 'Sunday manual queue', last_run: null },
  });
});

module.exports = router;
