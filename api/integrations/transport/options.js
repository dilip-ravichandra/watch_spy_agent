const { send } = require('../../_lib/http');
const { requireAuthenticatedUser } = require('../../_lib/auth-guard');
const { callMuleSoft } = require('../../_lib/mulesoft-client');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  if (!from || !to) return send(res, 400, { error: 'from and to are required' });

  const result = await callMuleSoft('/transport/options', {
    query: { userId: authUser.userId, from, to }
  });

  if (!result.ok && !result.mocked) return send(res, result.status || 502, { error: 'Transport options lookup failed' });

  return send(res, 200, result.mocked ? {
    success: true,
    mocked: true,
    options: [
      { mode: 'Public transport', etaMinutes: 35, note: 'On-time service expected' },
      { mode: 'Car', etaMinutes: 26, note: 'Moderate traffic' },
      { mode: 'Walk', etaMinutes: 72, note: 'Healthy fallback option' }
    ]
  } : { success: true, ...result.data });
};
