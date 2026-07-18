// agents/content.js — drafts personalised messages for all new leads
const mongoose = require('mongoose');
const { sendWhatsApp } = require('./report');

async function runContentAgent() {
  const Lead = mongoose.models.Lead;
  if (!Lead) return;

  const newLeads = await Lead.find({ status: 'new' }).limit(20);
  console.log(`[Content] Drafting messages for ${newLeads.length} leads...`);

  const drafts = [];
  for (const lead of newLeads) {
    const prompt = `You are a sales agent for Muzafar Jatoi selling a WhatsApp AI booking agent at €49/month.
Business: ${lead.name}, ${lead.city}, ${lead.country}. Category: ${lead.category}. Rating: ${lead.rating}★.
Write a WhatsApp outreach message in Albanian that: references their specific business, explains the AI agent in 1 sentence, offers 30-day free trial, ends with +355 68 317 7201. Max 4 sentences. Warm, genuine.`;

    const res = await fetch('https://outreach-ai-agent-production.up.railway.app/api/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:250, messages:[{role:'user',content:prompt}] })
    });
    const data = await res.json();
    const msg = data.content?.[0]?.text || '';
    if (msg) drafts.push({ lead: lead._id, name: lead.name, city: lead.city, message: msg });
    await new Promise(r => setTimeout(r, 300)); // rate limit
  }

  // Send approval queue summary to Muzafar's WhatsApp
  if (drafts.length > 0) {
    const summary = `✍️ *${drafts.length} messages drafted and ready for approval*\n\nOpen the OutreachAI dashboard to review and send:\nhttps://your-app.railway.app\n\n_Reply "approve all" to send automatically_`;
    await sendWhatsApp(process.env.REPORT_WA_NUMBER, summary);
  }

  console.log(`[Content] ${drafts.length} messages drafted`);
  return drafts;
}

module.exports = { runContentAgent };
