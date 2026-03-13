const { sql, ensureSchema } = require('../_lib/db');
const { json, nowIso, parseBody, userIdFrom, safeHour } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  await ensureSchema();

  const body = parseBody(req);
  const userId = userIdFrom(req, body);
  const timestampIso = String(body.timestamp || nowIso());

  const event = {
    userId,
    timestampIso,
    hourOfDay: safeHour(timestampIso),
    location: String(body.location || 'unknown'),
    destination: String(body.destination || body.location || 'unknown'),
    action: String(body.action || 'check schedule'),
    notes: String(body.notes || ''),
    source: String(body.source || 'watch'),
    createdAt: nowIso()
  };

  await sql`
    INSERT INTO habit_events (user_id, timestamp_iso, hour_of_day, location, destination, action, notes, source, created_at)
    VALUES (${event.userId}, ${event.timestampIso}, ${event.hourOfDay}, ${event.location}, ${event.destination}, ${event.action}, ${event.notes}, ${event.source}, ${event.createdAt})
  `;

  const favorite = await sql`
    SELECT action, COUNT(*)::int AS action_count
    FROM habit_events
    WHERE user_id = ${event.userId}
    GROUP BY action
    ORDER BY COUNT(*) DESC
    LIMIT 1
  `;

  return json(res, 200, {
    success: true,
    userId: event.userId,
    trackedAt: event.timestampIso,
    storedIn: 'postgres',
    learnedFavoriteAction: favorite.rows[0]?.action || event.action,
    message: 'Thank you. I saved this routine in persistent storage and will use it for kinder reminders.'
  });
};
