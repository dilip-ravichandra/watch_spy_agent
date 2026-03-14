const { send } = require('../../_lib/http');
const { requireAuthenticatedUser } = require('../../_lib/auth-guard');
const { callMuleSoft } = require('../../_lib/mulesoft-client');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const limit = Math.min(20, Math.max(1, Number(req.query.limit || 5)));
  const result = await callMuleSoft('/calendar/upcoming', {
    query: { userId: authUser.userId, limit }
  });

  if (!result.ok && !result.mocked) return send(res, result.status || 502, { error: 'Calendar fetch failed' });

  return send(res, 200, result.mocked ? {
    success: true,
    mocked: true,
    events: [
      {
        title: 'Daily planning check-in',
        startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        source: 'mock'
      }
    ]
  } : { success: true, ...result.data });
};
