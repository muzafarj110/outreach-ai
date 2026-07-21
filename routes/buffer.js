const express = require('express');
const router = express.Router();

const BUFFER_API = 'https://api.buffer.com/graphql';
const TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const ORG_ID = process.env.BUFFER_ORG_ID;

const CHANNEL_MAP = {
  instagram: process.env.BUFFER_INSTAGRAM_ID,
  facebook:  process.env.BUFFER_FACEBOOK_ID,
  linkedin:  process.env.BUFFER_LINKEDIN_ID
};

router.post('/post', async (req, res) => {
  try {
const { text, channel, imageUrl, language } = req.body;
    if (!text || !channel) return res.status(400).json({ error: 'text and channel required' });

    const channelId = CHANNEL_MAP[channel.toLowerCase()];
    if (!channelId) return res.status(400).json({ error: `Unknown channel: ${channel}` });

    const mutation = `
      mutation CreateIdea {
        createIdea(input: {
          organizationId: "${ORG_ID}",
          content: {
            title: "OutreachAI Post (${language || 'EN'})",
            text: ${JSON.stringify(text)},
            media: { url: "${imageUrl || ''}" }
          }
        }) {
          ... on Idea {
            id
            content { title text }
          }
        }
      }
    `;

    const response = await fetch(BUFFER_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: mutation })
    });

    const data = await response.json();
    if (data.errors) return res.status(502).json({ error: data.errors[0].message });

    res.json({ success: true, idea: data.data.createIdea });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
