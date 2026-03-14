const crypto = require('crypto');

const CSRF_COOKIE_NAME = 'chrono_csrf';

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  const out = {};
  if (!raw) return out;

  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    out[key] = decodeURIComponent(rest.join('=') || '');
  }

  return out;
}

function createCsrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

function csrfCookieValue(req) {
  const cookies = parseCookies(req);
  return String(cookies[CSRF_COOKIE_NAME] || '').trim();
}

function csrfHeaderValue(req) {
  return String(req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'] || '').trim();
}

function buildCsrfCookie(token) {
  const secure = String(process.env.NODE_ENV || '').toLowerCase() === 'production' ? '; Secure' : '';
  return `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 12}${secure}`;
}

function issueCsrfToken(req, res) {
  const existing = csrfCookieValue(req);
  const token = existing || createCsrfToken();
  res.setHeader('Set-Cookie', buildCsrfCookie(token));
  return token;
}

function hasValidCsrf(req) {
  const cookieToken = csrfCookieValue(req);
  const headerToken = csrfHeaderValue(req);
  return !!cookieToken && !!headerToken && cookieToken === headerToken;
}

module.exports = {
  CSRF_COOKIE_NAME,
  issueCsrfToken,
  hasValidCsrf,
  csrfCookieValue
};
