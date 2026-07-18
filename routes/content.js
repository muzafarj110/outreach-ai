// ═══════════════════════════════════════════════════
// routes/content.js
// Secure proxy to Claude API.
// The browser NEVER sees the API key.
// ═══════════════════════════════════════════════════

const express  = require('express');
const requireAuth = require('../middleware/auth');
const router   = express.Router();

// All content routes require a valid JWT
router.use(requireAuth);

// POST /api/content/generate
router.post('/generate', async (req, res, next) => {
  try {
    const { country, contentType, category, language, businessName, city, rating } = req.body;

    if (!country || !contentType)
      return res.status(400).json({ error: 'country and contentType are required' });

    // Build the prompt dynamically based on user inputs
    const prompt = buildPrompt({ country, contentType, category, language, businessName, city, rating });

    // Call Claude — API key from Railway env vars, never from client
    const response = await fetch('https://outreach-ai-agent-production.up.railway.app/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,  // ← secure, server-side only
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Claude API error:', err);
      return res.status(502).json({ error: 'Claude API unavailable. Check your API key.' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Log usage per user (for billing later)
    console.log(`[Content] User ${req.userId} | ${country} | ${contentType} | ~${data.usage?.output_tokens} tokens`);

    res.json({ content: text, tokens: data.usage });

  } catch (err) { next(err); }
});

// POST /api/content/personalise — takes a lead and writes a personalised message
router.post('/personalise', async (req, res, next) => {
  try {
    const { lead } = req.body; // { name, city, category, rating, review_count, caption, language }
    if (!lead?.name) return res.status(400).json({ error: 'lead object required' });

    const prompt = `You are a sales agent for Muzafar Jatoi, who sells a WhatsApp AI booking agent at €49/month to tourism businesses.

Business: ${lead.name}
City: ${lead.city || 'Unknown'}
Country: ${lead.country || 'Albania'}
Category: ${lead.category || 'tourism'}
Google rating: ${lead.rating || 4.5} (${lead.review_count || 50}+ reviews)
Recent Instagram caption: ${lead.caption || 'Not available'}
Language they use: ${lead.language || 'Albanian'}

Write a WhatsApp outreach message in ${lead.language || 'Albanian'} that:
- Opens by referencing something specific about their business (not generic)
- Explains the WhatsApp AI agent in one sentence
- Mentions 30-day free trial
- Ends with: Muzafar — +355 68 317 7201
- Maximum 4 sentences
- Warm, genuine, not salesy
- If Albanian, use proper ë and ç characters`;

    const response = await fetch('https://outreach-ai-agent-production.up.railway.app/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    res.json({ message: data.content?.[0]?.text || '', tokens: data.usage });

  } catch (err) { next(err); }
});

function buildPrompt({ country, contentType, category, language, businessName, city, rating }) {
  const demo = 'wa.me/13078868139';
  const contact = '+355 68 317 7201';
  const targets = {
    'Instagram Caption': `Write an Instagram caption for a ${category || 'tourism business'} in ${city || country}. Problem: missed WhatsApp bookings at night. Solution: AI answers instantly in 4 languages. Include free 30-day trial. End with demo link: ${demo}. Language: ${language || 'English'}. Max 120 words. Authentic, not salesy.`,
    'TikTok Script': `Write a 45-second TikTok script for a salesperson visiting ${country} selling a WhatsApp AI booking agent. Open with a shocking stat (e.g. average reply time). Show the problem. Demo the solution. Call to action: message ${demo}. Language: ${language || 'English'}. Include [VISUAL] and [VOICEOVER] cues.`,
    'FB Group Post': `Write a value-first Facebook group post for ${country} tourism business owners. Share a real insight about missed WhatsApp bookings. Soft pitch at the end for AI agent at €49/month. Language: ${language || 'English'}. Max 150 words.`,
    'WhatsApp DM': `Write a cold WhatsApp outreach message for ${businessName || 'a tourism business'} in ${city || country}. Rating: ${rating || 4.5}★. Reference their specific business. One sentence on AI booking agent. Offer 30-day free trial. Contact: ${contact}. Max 4 sentences. Language: ${language || 'Albanian'}.`
  };
  return targets[contentType] || targets['Instagram Caption'];
}

module.exports = router;
