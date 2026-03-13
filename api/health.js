const { ensureSchema } = require('./_lib/db');
const { json } = require('./_lib/utils');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  await ensureSchema();

  return json(res, 200, {
    status: 'ok',
    app: 'watch-kind-assistant-vercel',
    storage: 'postgres',
    aiIntegrationEnabled: String(process.env.AI_ENABLED || 'false') === 'true',
    scheduledDispatchEnabled: String(process.env.NOTIFICATIONS_DISPATCH_ENABLED || 'false') === 'true',
    message: 'Kind watch assistant is ready on Vercel.',
    now: new Date().toISOString()
  });
};
