const { send } = require('../../_lib/http');
const { requireAuthenticatedUser } = require('../../_lib/auth-guard');
const { callMuleSoft } = require('../../_lib/mulesoft-client');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const origin = String(req.query.origin || '').trim();
  const destination = String(req.query.destination || '').trim();
  if (!origin || !destination) return send(res, 400, { error: 'origin and destination are required' });

  const result = await callMuleSoft('/maps/traffic', { query: { userId: authUser.userId, origin, destination } });
  if (!result.ok && !result.mocked) return send(res, result.status || 502, { error: 'Traffic lookup failed' });

  return send(res, 200, result.mocked ? {
    success: true,
    mocked: true,
    route: {
      origin,
      destination,
      durationMinutes: 28,
      congestionLevel: 'moderate',
      recommendation: 'Leave 10 minutes early for a comfortable commute.'
    }
  } : { success: true, ...result.data });
};
