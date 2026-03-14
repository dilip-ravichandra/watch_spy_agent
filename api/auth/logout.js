const { send } = require('../_lib/http');
const { deleteSessionByToken } = require('../_lib/auth-store');
const { readSessionToken, clearSessionCookie } = require('../_lib/auth-cookie');
const { hasValidCsrf } = require('../_lib/csrf');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!hasValidCsrf(req)) return send(res, 403, { error: 'Invalid CSRF token' });

  try {
    const token = readSessionToken(req);
    if (token) await deleteSessionByToken(token);
    res.setHeader('Set-Cookie', clearSessionCookie());
    return send(res, 200, { success: true });
  } catch (error) {
    return send(res, 500, { error: 'Logout failed', message: error?.message || 'unknown' });
  }
};
