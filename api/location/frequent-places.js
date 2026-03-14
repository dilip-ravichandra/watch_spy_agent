const { send } = require('../_lib/http');
const { requireAuthenticatedUser } = require('../_lib/auth-guard');
const { detectFrequentPlaces } = require('../_lib/assistant-store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const minVisits = Math.min(20, Math.max(2, Number(req.query.minVisits || 3)));
  const places = await detectFrequentPlaces(authUser.userId, minVisits);

  return send(res, 200, {
    success: true,
    count: places.length,
    places
  });
};
