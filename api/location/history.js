const { send } = require('../_lib/http');
const { requireAuthenticatedUser } = require('../_lib/auth-guard');
const { getLocationHistory } = require('../_lib/assistant-store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  const rows = await getLocationHistory(authUser.userId, limit);

  return send(res, 200, {
    success: true,
    count: rows.length,
    locations: rows
  });
};
