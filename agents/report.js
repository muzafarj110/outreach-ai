// ═══════════════════════════════════════════════════
// agents/report.js
// Sends daily WhatsApp report at 7am Gulf time.
// ═══════════════════════════════════════════════════

const mongoose = require('mongoose');

async function runReportAgent() {
  const Lead = mongoose.models.Lead;
  if (!Lead) return console.error('[Report] Lead model not loaded');

  const today = new Date();
  today.setHours(0,0,0,0);

  // Gather stats
  const [newToday, sent, replied, trials, paying] = await Promise.all([
    Lead.countDocuments({ found_at: { $gte: today } }),
    Lead.countDocuments({ outreach_date: { $gte: today } }),
    Lead.countDocuments({ reply_date: { $gte: today } }),
    Lead.countDocuments({ status: 'trial' }),
    Lead.countDocuments({ status: 'paying' }),
  ]);

  const payingLeads = await Lead.find({ status: 'paying' }).select('mrr');
  const mrr = payingLeads.reduce((sum, l) => sum + (l.mrr || 0), 0);

  const interested = await Lead.find({ status: 'interested' }).select('name city').limit(3);
  const dueFollowUp = await Lead.countDocuments({
    status: 'contacted',
    outreach_date: { $lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
  });

  const dateStr = today.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });

  const report = `📊 *DAILY REPORT — ${dateStr}*
━━━━━━━━━━━━━━━━━━━━━━━━━
NEW LEADS FOUND: ${newToday}
MESSAGES SENT: ${sent}
REPLIES: ${replied} (${sent > 0 ? Math.round(replied/sent*100) : 0}% rate)
━━━━━━━━━━━━━━━━━━━━━━━━━
ACTIVE TRIALS: ${trials}
PAYING CUSTOMERS: ${paying}
MRR: €${mrr}/month
━━━━━━━━━━━━━━━━━━━━━━━━━
FOLLOW-UPS DUE: ${dueFollowUp} leads
${interested.length > 0 ? '\n⭐ INTERESTED:\n' + interested.map(l => `  → ${l.name} (${l.city})`).join('\n') : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━
_OutreachAI Platform_`;

  // Send via WhatsApp (360dialog API)
  await sendWhatsApp(process.env.REPORT_WA_NUMBER, report);

  console.log(`[Report] Daily report sent to ${process.env.REPORT_WA_NUMBER}`);
}

async function sendWhatsApp(to, message) {
  const url = `https://waba.360dialog.io/v1/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'D360-API-KEY': process.env.DIALOG360_API_KEY,
    },
    body: JSON.stringify({
      recipient_type: 'individual',
      to: to.replace(/[^0-9]/g, ''),
      type: 'text',
      text: { body: message }
    })
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('[WhatsApp] Send failed:', err);
  }
}

module.exports = { runReportAgent, sendWhatsApp };
