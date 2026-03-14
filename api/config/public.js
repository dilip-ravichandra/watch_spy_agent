const { send } = require('../_lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  return send(res, 200, {
    success: true,
    mapsApiKey: String(process.env.GOOGLE_MAPS_API_KEY || '').trim(),
    features: {
      mulesoftConfigured: !!(process.env.MULESOFT_BASE_URL && process.env.MULESOFT_CLIENT_ID && process.env.MULESOFT_CLIENT_SECRET),
      aiEnabled: String(process.env.AI_ENABLED || 'false') === 'true'
    }
  });
};
