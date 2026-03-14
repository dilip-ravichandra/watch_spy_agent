const { parseBody, send } = require('../../_lib/http');
const { requireAuthenticatedUser } = require('../../_lib/auth-guard');
const { callMuleSoft } = require('../../_lib/mulesoft-client');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const body = parseBody(req);
  const title = String(body.title || '').trim();
  const startTime = String(body.startTime || '').trim();
  const endTime = String(body.endTime || '').trim();
  if (!title || !startTime) return send(res, 400, { error: 'title and startTime are required' });

  const result = await callMuleSoft('/calendar/reminders', {
    method: 'POST',
    body: {
      userId: authUser.userId,
      title,
      startTime,
      endTime,
      description: String(body.description || '').trim()
    }
  });

  if (!result.ok && !result.mocked) return send(res, result.status || 502, { error: 'Calendar reminder creation failed' });

  return send(res, 200, result.mocked ? {
    success: true,
    mocked: true,
    message: 'Reminder accepted in mock mode. Configure MuleSoft for live Google Calendar writes.'
  } : { success: true, ...result.data });
};
