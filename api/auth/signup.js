const { parseBody, send } = require('../_lib/http');
const { createUser, createSession, authStorageMode, normalizeEmail, normalizeUserId } = require('../_lib/auth-store');
const { buildSessionCookie } = require('../_lib/auth-cookie');
const { hasValidCsrf } = require('../_lib/csrf');
const { checkRateLimit } = require('../_lib/rate-limit');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!hasValidCsrf(req)) return send(res, 403, { error: 'Invalid CSRF token' });

  const rate = checkRateLimit({ req, res, key: 'auth-signup', limit: 5, windowMs: 10 * 60 * 1000 });
  if (!rate.allowed) {
    return send(res, 429, {
      error: 'Too many signup attempts. Please try again later.',
      retryAfterSeconds: rate.retryAfterSeconds
    });
  }

  try {
    const body = parseBody(req);
    const userId = normalizeUserId(body.userId);
    const email = String(body.email || '').trim();
    const emailLower = normalizeEmail(email);
    const password = String(body.password || '');
    const fullName = String(body.fullName || '').trim();

    if (!userId || !/^[a-zA-Z0-9_.-]{3,32}$/.test(userId)) {
      return send(res, 400, { error: 'Invalid userId. Use 3-32 chars: letters, numbers, _, -, .' });
    }
    if (!emailLower || !/^\S+@\S+\.\S+$/.test(emailLower)) {
      return send(res, 400, { error: 'Valid email is required' });
    }
    if (password.length < 8) {
      return send(res, 400, { error: 'Password must be at least 8 characters' });
    }

    const user = await createUser({ userId, email, password, fullName });
    const session = await createSession(user);
    res.setHeader('Set-Cookie', buildSessionCookie(session.token));

    return send(res, 201, {
      success: true,
      user,
      session: { expiresAt: session.expiresAt },
      storage: authStorageMode()
    });
  } catch (error) {
    if (error?.code === 'DUPLICATE_USER') {
      return send(res, 409, { error: `${error.field} already exists`, field: error.field });
    }
    return send(res, 500, { error: 'Signup failed', message: error?.message || 'unknown' });
  }
};
