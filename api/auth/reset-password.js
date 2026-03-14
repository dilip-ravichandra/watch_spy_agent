const { parseBody, send } = require('../_lib/http');
const { normalizeEmail, consumePasswordResetToken, updatePasswordByUserId } = require('../_lib/auth-store');
const { hasValidCsrf } = require('../_lib/csrf');
const { checkRateLimit } = require('../_lib/rate-limit');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!hasValidCsrf(req)) return send(res, 403, { error: 'Invalid CSRF token' });

  const rate = checkRateLimit({ req, res, key: 'auth-reset-password', limit: 10, windowMs: 10 * 60 * 1000 });
  if (!rate.allowed) {
    return send(res, 429, {
      error: 'Too many password reset attempts. Please try again later.',
      retryAfterSeconds: rate.retryAfterSeconds
    });
  }

  try {
    const body = parseBody(req);
    const email = normalizeEmail(body.email);
    const token = String(body.token || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Valid email is required' });
    if (!token) return send(res, 400, { error: 'Reset token is required' });
    if (newPassword.length < 8) return send(res, 400, { error: 'Password must be at least 8 characters' });

    const consumed = await consumePasswordResetToken(email, token);
    if (!consumed) return send(res, 400, { error: 'Reset link is invalid or expired' });

    const changed = await updatePasswordByUserId(consumed.userId, newPassword);
    if (!changed) return send(res, 500, { error: 'Could not update password' });

    return send(res, 200, {
      success: true,
      message: 'Password updated successfully. Please login with your new password.'
    });
  } catch (error) {
    return send(res, 500, { error: 'Reset password failed', message: error?.message || 'unknown' });
  }
};
