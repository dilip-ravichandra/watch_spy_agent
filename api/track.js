const { parseBody, send } = require('./_lib/http');
const { requireAuthenticatedUser } = require('./_lib/auth-guard');
const { saveEvent, getEventsByUser } = require('./_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const body = parseBody(req);
  const uid = authUser.userId;

  const event = await saveEvent({
    userId: uid,
    timestamp: body.timestamp,
    location: body.location,
    destination: body.destination,
    action: body.action,
    note: body.note
  });

  const events = await getEventsByUser(uid, 200);

  return send(res, 200, {
    success: true,
    userId: uid,
    totalEvents: events.length,
    lastEvent: event,
    message: 'Event tracked successfully.'
  });
};
