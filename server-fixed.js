require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/outreachai')
  .then(() => console.log('MongoDB connected'))
  .catch(e => console.error('MongoDB error:', e.message));

app.post('/api/content/generate', async (req, res) => {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: 'Write an Instagram caption in Albanian for a guesthouse in Saranda.' }]
      })
    });
    const data = await r.json();
    res.json({ content: data.content?.[0]?.text || JSON.stringify(data) });
  } catch (e) {
    res.status(500).json({ content: 'Error: ' + e.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(express.static('/Users/muzafarjatoi/Documents'));
app.get('/', (req, res) => res.sendFile('/Users/muzafarjatoi/Documents/ai-agent-platform.html'));

app.listen(3000, () => console.log('Running on http://localhost:3000'));
