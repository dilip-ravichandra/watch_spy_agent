const { parseBody, send } = require('../_lib/http');
const { requireAuthenticatedUser } = require('../_lib/auth-guard');
const { saveLocationPoint } = require('../_lib/assistant-store');
const { asNumber, inRange, asTrimmed } = require('../_lib/validate');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const body = parseBody(req);
  const latitude = asNumber(body.latitude, NaN);
  const longitude = asNumber(body.longitude, NaN);
  const accuracy = asNumber(body.accuracy, NaN);

  if (!inRange(latitude, -90, 90)) return send(res, 400, { error: 'Invalid latitude' });
  if (!inRange(longitude, -180, 180)) return send(res, 400, { error: 'Invalid longitude' });

  const result = await saveLocationPoint({
    userId: authUser.userId,
    latitude,
    longitude,
    accuracy,
    source: asTrimmed(body.source || 'manual'),
    label: asTrimmed(body.label || '')
  });

  if (!result.ok) return send(res, 500, { error: result.error || 'Could not save location' });

  return send(res, 200, {
    success: true,
    location: result.location,
    message: 'Location saved. I will learn your routine over time.'
  });
};
