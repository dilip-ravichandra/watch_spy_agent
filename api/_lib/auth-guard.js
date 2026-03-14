const { getUserByToken } = require('./auth-store');
const { readSessionToken } = require('./auth-cookie');

async function getAuthenticatedUser(req) {
  const token = readSessionToken(req);
  if (!token) return null;
  return getUserByToken(token);
}

async function requireAuthenticatedUser(req, res, sendFn) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    sendFn(res, 401, { error: 'Authentication required' });
    return null;
  }
  return user;
}

module.exports = {
  getAuthenticatedUser,
  requireAuthenticatedUser
};
