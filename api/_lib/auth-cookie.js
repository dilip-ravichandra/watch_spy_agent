const COOKIE_NAME = 'chrono_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  const out = {};
  if (!raw) return out;

  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('=') || '');
  }
  return out;
}

function readSessionToken(req) {
  const header = String(req.headers.authorization || req.headers.Authorization || '');
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  const cookies = parseCookies(req);
  return String(cookies[COOKIE_NAME] || '').trim();
}

function buildSessionCookie(token) {
  const secure = String(process.env.NODE_ENV || '').toLowerCase() === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function clearSessionCookie() {
  const secure = String(process.env.NODE_ENV || '').toLowerCase() === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

module.exports = {
  COOKIE_NAME,
  parseCookies,
  readSessionToken,
  buildSessionCookie,
  clearSessionCookie
};
