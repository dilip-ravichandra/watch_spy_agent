const { parseBody, send } = require('../../_lib/http');
const { requireAuthenticatedUser } = require('../../_lib/auth-guard');
const { sendEmail } = require('../../_lib/mailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const body = parseBody(req);
  const to = String(body.to || authUser.email || '').trim();
  const message = String(body.message || '').trim();

  if (!to || !message) return send(res, 400, { error: 'to and message are required' });

  const result = await sendEmail({
    to,
    subject: String(body.subject || 'Chrono reminder'),
    text: message,
    html: `<p>${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
  }).catch((e) => ({ sent: false, reason: e?.message || 'send failed' }));

  return send(res, 200, {
    success: !!result.sent,
    emailSent: !!result.sent,
    reason: result.reason || null
  });
};
