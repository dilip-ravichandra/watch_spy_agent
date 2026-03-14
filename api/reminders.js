const { getDb, ensureSchema } = require('./_lib/db');
const { json, buildSuggestion } = require('./_lib/utils');
const { requireAuthenticatedUser } = require('./_lib/auth-guard');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, json);
  if (!authUser) return;

  await ensureSchema();
  const db = await getDb();
  if (!db) return json(res, 500, { error: 'MongoDB is not configured' });

  const userId = authUser.userId;
  const requestTimestamp = String(req.query.timestamp || new Date().toISOString());
  const currentLocation = String(req.query.currentLocation || 'unknown');

  const rows = await db
    .collection('events')
    .find({ userId })
    .sort({ _id: -1 })
    .limit(500)
    .toArray();

  const normalized = rows.map((r) => ({
    timestamp_iso: r.timestampIso || r.timestamp || r.timestamp_iso,
    location: r.location,
    destination: r.destination,
    action: r.action,
    source: r.source
  }));

  const suggestion = buildSuggestion(normalized, requestTimestamp, currentLocation);

  return json(res, 200, {
    userId,
    learnedFromEvents: suggestion.learnedFromEvents,
    reminderTime: requestTimestamp,
    suggestedAction: suggestion.suggestedAction,
    suggestedDestination: suggestion.suggestedDestination,
    message: suggestion.message,
    question: 'What would you like me to do for you right now?',
    options: [
      { label: 'Yes, remind me now', value: 'remind_now' },
      { label: 'Remind me in 15 minutes', value: 'remind_later' },
      { label: 'I am already on my way', value: 'already_moving' },
      { label: 'Skip today, thanks', value: 'skip_today' }
    ]
  });
};
