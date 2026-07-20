// ═══════════════════════════════════════════════════
// routes/content.js
// Secure proxy to Claude API.
// The browser NEVER sees the API key.
// ═══════════════════════════════════════════════════

const express  = require('express');
const requireAuth = require('../middleware/auth');
const router   = express.Router();

// All content routes require a valid JWT
// router.use(requireAuth);

// POST /api/content/generate
router.post('/generate', async (req, res, next) => {
  try {
    const { country, contentType, category, language, businessName, city, rating } = req.body;

    if (!country || !contentType)
      return res.status(400).json({ error: 'country and contentType are required' });

    // Build the prompt dynamically based on user inputs
    const prompt = buildPrompt({ country, contentType, category, language, businessName, city, rating });

    // Call Claude — API key from Railway env vars, never from client
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
  const loc = city || country;
  const biz = businessName || `a ${category || 'tourism business'} in ${loc}`;
  const lang = language || 'English';

  const targets = {
    'Instagram Caption': `You are a social media expert for an AI WhatsApp booking agent targeting tourism businesses in ${country}. Write an Instagram caption for a ${category || 'tourism business'} in ${loc}. Language: ${lang}. Rules: Open with a hook (missed bookings, slow replies, lost revenue). One sentence on AI solution (24/7 WhatsApp, 4 languages). Mention free 30-day trial. End with CTA: ${demo}. Max 120 words. Authentic, not salesy. 2-3 emojis. If Albanian use ë and ç. Include 5 hashtags.`,

    'TikTok Script': `You are a TikTok scriptwriter for a sales rep visiting ${country} selling a WhatsApp AI booking agent at €49/month. Write a punchy 45-second TikTok script. Language: ${lang}. Structure: [0-3s] Hook: shocking stat about missed bookings. [3-15s] Problem: tourist sends WhatsApp, no reply, books elsewhere. [15-35s] Solution: AI replies in 3 seconds, 24/7, 4 languages. [35-45s] CTA: message ${demo} for free 30-day trial. Use [VISUAL:] and [VOICEOVER:] cues. Include production notes table at the end.`,

    'FB Group Post': `You are a marketing consultant writing for a ${country} tourism business Facebook group. Language: ${lang}. Write a value-first post — no hard sell in first 80%. Structure: Open with a question (how many bookings did you miss last night?). Share a stat about WhatsApp response times. Tell a short anonymous success story. Soft CTA at end: AI booking agent €49/month, free trial, contact ${contact}. Max 200 words. Conversational. Max 2 emojis.`,

    'WhatsApp DM': `You are a sales rep for an AI WhatsApp booking agent. Write a cold outreach WhatsApp message. Business: ${biz}. Rating: ${rating || 4.5}★. Language: ${lang}. Rules: Open referencing their business (rating, category, location). One sentence on the AI agent. Mention 30-day free trial, no contract, no risk. Close with: Muzafar — ${contact}. MAX 4 sentences. Warm and genuine. If Albanian use ë and ç.`
  };

  return targets[contentType] || targets['Instagram Caption'];
}

module.exports = router;
