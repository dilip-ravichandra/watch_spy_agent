const { getDb, ensureSchema } = require('../_lib/db');
const { json, nowIso, parseBody, safeHour } = require('../_lib/utils');
const { requireAuthenticatedUser } = require('../_lib/auth-guard');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, json);
  if (!authUser) return;

  await ensureSchema();
  const db = await getDb();
  if (!db) return json(res, 500, { error: 'MongoDB is not configured' });

  const body = parseBody(req);
  const userId = authUser.userId;
  const timestampIso = String(body.timestamp || nowIso());

  const event = {
    userId,
    timestamp: timestampIso,
    timestampIso,
    hourOfDay: safeHour(timestampIso),
    location: String(body.location || 'unknown'),
    destination: String(body.destination || body.location || 'unknown'),
    action: String(body.action || 'check schedule'),
    notes: String(body.notes || ''),
    source: String(body.source || 'watch'),
    createdAt: nowIso()
  };

  await db.collection('events').insertOne(event);

  const favorite = await db.collection('events').aggregate([
    { $match: { userId: event.userId } },
    { $group: { _id: '$action', action_count: { $sum: 1 } } },
    { $sort: { action_count: -1 } },
    { $limit: 1 }
  ]).toArray();

  return json(res, 200, {
    success: true,
    userId: event.userId,
    trackedAt: event.timestampIso,
    storedIn: 'mongodb',
    learnedFavoriteAction: favorite[0]?._id || event.action,
    message: 'Thank you. I saved this routine in persistent storage and will use it for kinder reminders.'
  });
};
