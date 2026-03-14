const { send } = require('../_lib/http');
const { issueCsrfToken } = require('../_lib/csrf');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const token = issueCsrfToken(req, res);
  return send(res, 200, { success: true, csrfToken: token });
};
