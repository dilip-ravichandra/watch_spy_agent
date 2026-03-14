const { send } = require('../../_lib/http');
const { requireAuthenticatedUser } = require('../../_lib/auth-guard');
const { callMuleSoft } = require('../../_lib/mulesoft-client');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const location = String(req.query.location || '').trim();
  if (!location) return send(res, 400, { error: 'location is required' });

  const result = await callMuleSoft('/weather/current', {
    query: { userId: authUser.userId, location }
  });

  if (!result.ok && !result.mocked) return send(res, result.status || 502, { error: 'Weather lookup failed' });

  return send(res, 200, result.mocked ? {
    success: true,
    mocked: true,
    weather: {
      location,
      condition: 'Cloudy',
      temperatureC: 27,
      rainChancePercent: 60,
      suggestion: 'Carry an umbrella and plan a slightly earlier departure.'
    }
  } : { success: true, ...result.data });
};
