const { send } = require('./_lib/http');
const { storageMode, nowIso } = require('./_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  return send(res, 200, {
    status: 'ok',
    app: 'watch-spy-agent-lite',
    storage: await storageMode(),
    aiProvider: 'groq',
    now: nowIso()
  });
};
