const { parseBody, send } = require('../../_lib/http');
const { requireAuthenticatedUser } = require('../../_lib/auth-guard');
const { callMuleSoft } = require('../../_lib/mulesoft-client');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const body = parseBody(req);
  const title = String(body.title || '').trim();
  const message = String(body.message || '').trim();
  if (!title || !message) return send(res, 400, { error: 'title and message are required' });

  const result = await callMuleSoft('/notifications/send', {
    method: 'POST',
    body: {
      userId: authUser.userId,
      title,
      message,
      type: String(body.type || 'assistant')
    }
  });

  if (!result.ok && !result.mocked) return send(res, result.status || 502, { error: 'Notification send failed' });

  return send(res, 200, result.mocked ? {
    success: true,
    mocked: true,
    channel: 'local',
    message: 'Notification accepted in mock mode. Configure MuleSoft+FCM for device push delivery.'
  } : { success: true, ...result.data });
};
