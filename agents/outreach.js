// agents/outreach.js — sends follow-ups to leads that haven't replied
const mongoose = require('mongoose');
const { sendWhatsApp } = require('./report');

async function runOutreachAgent() {
  const Lead = mongoose.models.Lead;
  if (!Lead) return;

  const threeDaysAgo = new Date(Date.now() - 3*24*60*60*1000);
  const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000);

  // Day 3 follow-up
  const day3 = await Lead.find({
    status: 'contacted',
    outreach_date: { $lte: threeDaysAgo, $gt: sevenDaysAgo },
    reply_date: null
  });

  for (const lead of day3) {
    const msg = `Përshëndetje! Vetëm doja të sigurohesha që mesazhi im arriti. Sistemi AI që ju prezantova mund t'u përgjigjet mysafirëve tuaj në 5 sekonda, edhe natën. 30 ditë falas. A kemi kohë për një demonstrim 60-sekondësh? +355 68 317 7201`;
    if (lead.whatsapp || lead.phone) {
      await sendWhatsApp(lead.whatsapp || lead.phone, msg);
      await Lead.findByIdAndUpdate(lead._id, { $set: { notes: (lead.notes||'') + '\nDay 3 follow-up sent: ' + new Date().toISOString() }});
      console.log(`[Outreach] Day 3 follow-up sent: ${lead.name}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[Outreach] Done. Sent ${day3.length} day-3 follow-ups.`);
}

module.exports = { runOutreachAgent };
