// ═══════════════════════════════════════════════════
// OutreachAI Backend — server.js
// Runs 24/7 on Railway. Holds all secrets securely.
// ═══════════════════════════════════════════════════

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const mongoose   = require('mongoose');
const cron       = require('node-cron');

const app = express();

// ─── SECURITY LAYER 1: HELMET ─────────────────────
// Sets 11 HTTP headers that block common attacks
// (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet({ contentSecurityPolicy: false }));

// ─── SECURITY LAYER 2: CORS ───────────────────────
// Only YOUR frontend domain can call this server.
// Change this to your Railway frontend URL.
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  process.env.FRONTEND_URL,         // set in Railway env vars
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow Postman / server-to-server calls (no origin)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));

app.use(express.json({ limit: '10kb' })); // body size cap

// ─── SECURITY LAYER 3: RATE LIMITING ──────────────
// Prevents brute force and abuse
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per IP per 15min
  message: { error: 'Too many requests. Slow down.' }
});

const claudeLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 20,                    // 20 Claude calls per minute per IP
  message: { error: 'AI rate limit reached. Wait 1 minute.' }
});

app.use('/api/', generalLimiter);
app.use('/api/content/', claudeLimiter);

// ─── DATABASE ─────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
}).then(() => {
  console.log('✅ MongoDB connected');
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1); // crash loudly so Railway restarts it
});

// ─── ROUTES ───────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/content',  require('./routes/content'));
app.use('/api/leads',    require('./routes/leads'));
app.use('/api/agents',   require('./routes/agents'));
app.use('/api/report',   require('./routes/report'));

// ─── HEALTH CHECK ─────────────────────────────────
// Railway pings this to confirm your app is alive
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()) + 's',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────
// Catches crashes without exposing stack traces to clients
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
    // NEVER send stack traces to production clients
  });
});

// ─── CRON JOBS (the 24/7 agents) ──────────────────
// These run automatically — no browser needed
const { runResearchAgent }  = require('./agents/research');
const { runContentAgent }   = require('./agents/content');
const { runOutreachAgent }  = require('./agents/outreach');
const { runReportAgent }    = require('./agents/report');

// Research Agent: 6:00 AM Gulf time (UTC+4 = 2:00 AM UTC)
cron.schedule('0 2 * * *', () => {
  console.log('🔍 Research Agent starting...');
  runResearchAgent().catch(e => console.error('Research Agent error:', e));
}, { timezone: 'UTC' });

// Content Agent: 6:30 AM Gulf time
cron.schedule('30 2 * * *', () => {
  console.log('✍️  Content Agent starting...');
  runContentAgent().catch(e => console.error('Content Agent error:', e));
}, { timezone: 'UTC' });

// Daily Report: 7:00 AM Gulf time
cron.schedule('0 3 * * *', () => {
  console.log('📊 Report Agent starting...');
  runReportAgent().catch(e => console.error('Report Agent error:', e));
}, { timezone: 'UTC' });

// Follow-up Outreach: 9:00 AM Gulf time
cron.schedule('0 5 * * 1-5', () => {
  // Mon-Fri only
  console.log('📤 Outreach Agent starting...');
  runOutreachAgent().catch(e => console.error('Outreach Agent error:', e));
}, { timezone: 'UTC' });

// ─── START ────────────────────────────────────────
// Railway injects PORT automatically
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 OutreachAI Backend running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ─── GRACEFUL SHUTDOWN ────────────────────────────
// Handles Railway restarts cleanly
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

// Serve the frontend HTML
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Disable CSP for development
app.use((req, res, next) => {
});
