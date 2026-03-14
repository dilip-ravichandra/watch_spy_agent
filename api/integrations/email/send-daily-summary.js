const { parseBody, send } = require('../../_lib/http');
const { requireAuthenticatedUser } = require('../../_lib/auth-guard');
const { sendEmail } = require('../../_lib/mailer');
const { getDailyInsight } = require('../../_lib/assistant-store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const body = parseBody(req);
  const to = String(body.to || authUser.email || '').trim();
  if (!to) return send(res, 400, { error: 'Target email is required' });

  const insight = await getDailyInsight(authUser.userId, new Date());
  const summary = insight?.summary || 'Your daily summary is being prepared. Keep tracking to unlock richer insights.';

  const result = await sendEmail({
    to,
    subject: 'Your Chrono Daily Summary',
    text: summary,
    html: `<h3>Your Chrono Daily Summary</h3><p>${summary.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
  }).catch((e) => ({ sent: false, reason: e?.message || 'send failed' }));

  return send(res, 200, {
    success: !!result.sent,
    emailSent: !!result.sent,
    summary,
    reason: result.reason || null
  });
};
