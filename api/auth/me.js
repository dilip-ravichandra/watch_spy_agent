const { send } = require('../_lib/http');
const { getUserByToken } = require('../_lib/auth-store');
const { readSessionToken } = require('../_lib/auth-cookie');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  try {
    const token = readSessionToken(req);
    if (!token) return send(res, 401, { error: 'Missing session token' });

    const user = await getUserByToken(token);
    if (!user) return send(res, 401, { error: 'Session invalid or expired' });

    return send(res, 200, { success: true, user });
  } catch (error) {
    return send(res, 500, { error: 'Session check failed', message: error?.message || 'unknown' });
  }
};
