const { send } = require('../_lib/http');
const { requireAuthenticatedUser } = require('../_lib/auth-guard');
const { getDailyInsight } = require('../_lib/assistant-store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const insight = await getDailyInsight(authUser.userId, new Date(req.query.date || Date.now()));
  if (!insight) {
    return send(res, 200, {
      success: true,
      summary: 'Daily insight is not available because persistent storage is not configured.'
    });
  }

  return send(res, 200, {
    success: true,
    ...insight
  });
};
