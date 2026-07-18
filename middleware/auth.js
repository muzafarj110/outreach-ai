// ═══════════════════════════════════════════════════
// middleware/auth.js
// JWT authentication — every route uses this.
// API keys NEVER leave the server.
// ═══════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

module.exports = function requireAuth(req, res, next) {
  // Token comes in the Authorization header: "Bearer <token>"
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];

  try {
    // Verify signature using your secret (stored in Railway env vars)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;       // { userId, email, plan }
    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};
