const { parseBody, send } = require('../_lib/http');
const { normalizeEmail, createPasswordResetToken } = require('../_lib/auth-store');
const { hasValidCsrf } = require('../_lib/csrf');
const { checkRateLimit } = require('../_lib/rate-limit');
const { sendPasswordResetEmail } = require('../_lib/mailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!hasValidCsrf(req)) return send(res, 403, { error: 'Invalid CSRF token' });

  const rate = checkRateLimit({ req, res, key: 'auth-forgot-password', limit: 5, windowMs: 10 * 60 * 1000 });
  if (!rate.allowed) {
    return send(res, 429, {
      error: 'Too many reset attempts. Please try again later.',
      retryAfterSeconds: rate.retryAfterSeconds
    });
  }

  try {
    const body = parseBody(req);
    const email = String(body.email || '').trim();
    const emailLower = normalizeEmail(email);
    if (!emailLower || !/^\S+@\S+\.\S+$/.test(emailLower)) {
      return send(res, 400, { error: 'Valid email is required' });
    }

    const ttlMinutes = Number(process.env.RESET_TOKEN_TTL_MINUTES || 15);
    const reset = await createPasswordResetToken(emailLower, ttlMinutes);
    if (reset) {
      const baseUrl = String(process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
      const resetLink = `${baseUrl}/auth.html?mode=reset&token=${encodeURIComponent(reset.token)}&email=${encodeURIComponent(reset.email)}`;

      let mailResult = { sent: false, reason: 'send not attempted' };
      try {
        mailResult = await sendPasswordResetEmail({ to: reset.email, resetLink });
      } catch (mailError) {
        mailResult = { sent: false, reason: mailError?.message || 'mail send failed' };
      }

      const exposeDebug = String(process.env.EXPOSE_DEV_RESET_LINK || 'true') === 'true' &&
        String(process.env.NODE_ENV || 'development') !== 'production';

      return send(res, 200, {
        success: true,
        message: 'If this email exists, a reset link has been sent.',
        emailSent: mailResult.sent,
        ...(exposeDebug ? { devResetLink: resetLink } : {})
      });
    }

    return send(res, 200, {
      success: true,
      message: 'If this email exists, a reset link has been sent.'
    });
  } catch (error) {
    return send(res, 500, { error: 'Forgot password request failed', message: error?.message || 'unknown' });
  }
};
