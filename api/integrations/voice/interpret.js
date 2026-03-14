const { parseBody, send } = require('../../_lib/http');
const { requireAuthenticatedUser } = require('../../_lib/auth-guard');
const { callMuleSoft } = require('../../_lib/mulesoft-client');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const body = parseBody(req);
  const transcript = String(body.transcript || '').trim();
  if (!transcript) return send(res, 400, { error: 'transcript is required' });

  const result = await callMuleSoft('/voice/interpret', {
    method: 'POST',
    body: { userId: authUser.userId, transcript }
  });

  if (!result.ok && !result.mocked) return send(res, result.status || 502, { error: 'Voice interpretation failed' });

  return send(res, 200, result.mocked ? {
    success: true,
    mocked: true,
    intent: 'reminder.request',
    entities: {},
    message: 'Voice integration is ready. Configure MuleSoft to connect STT/TTS services.'
  } : { success: true, ...result.data });
};
