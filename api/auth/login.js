const { parseBody, send } = require('../_lib/http');
const { verifyUser, createSession, authStorageMode, normalizeEmail } = require('../_lib/auth-store');
const { buildSessionCookie } = require('../_lib/auth-cookie');
const { hasValidCsrf } = require('../_lib/csrf');
const { checkRateLimit } = require('../_lib/rate-limit');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!hasValidCsrf(req)) return send(res, 403, { error: 'Invalid CSRF token' });

  const rate = checkRateLimit({ req, res, key: 'auth-login', limit: 10, windowMs: 10 * 60 * 1000 });
  if (!rate.allowed) {
    return send(res, 429, {
      error: 'Too many login attempts. Please try again later.',
      retryAfterSeconds: rate.retryAfterSeconds
    });
  }

  try {
    const body = parseBody(req);
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const emailLower = normalizeEmail(email);

    if (!emailLower || !password) {
      return send(res, 400, { error: 'Email and password are required' });
    }

    const user = await verifyUser(emailLower, password);
    if (!user) {
      return send(res, 401, { error: 'Invalid credentials' });
    }

    const session = await createSession(user);
    res.setHeader('Set-Cookie', buildSessionCookie(session.token));
    return send(res, 200, {
      success: true,
      user,
      session: { expiresAt: session.expiresAt },
      storage: authStorageMode()
    });
  } catch (error) {
    return send(res, 500, { error: 'Login failed', message: error?.message || 'unknown' });
  }
};
