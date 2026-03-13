const { sql, ensureSchema } = require('./_lib/db');
const { json, buildSuggestion, userIdFrom } = require('./_lib/utils');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  await ensureSchema();

  const userId = userIdFrom(req, {});
  const requestTimestamp = String(req.query.timestamp || new Date().toISOString());
  const currentLocation = String(req.query.currentLocation || 'unknown');

  const rows = await sql`
    SELECT timestamp_iso, location, destination, action, source
    FROM habit_events
    WHERE user_id = ${userId}
    ORDER BY id DESC
    LIMIT 500
  `;

  const suggestion = buildSuggestion(rows.rows, requestTimestamp, currentLocation);

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
