const { send } = require('./_lib/http');
const { requireAuthenticatedUser } = require('./_lib/auth-guard');
const { getEventsByUser, buildSuggestion, nowIso } = require('./_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const uid = authUser.userId;
  const timestamp = String(req.query.timestamp || nowIso());
  const currentLocation = String(req.query.currentLocation || 'unknown');

  const events = await getEventsByUser(uid, 500);
  const suggestion = buildSuggestion(events, timestamp, currentLocation);

  return send(res, 200, {
    userId: uid,
    reminderTime: timestamp,
    ...suggestion,
    options: [
      { label: 'Remind me now', value: 'remind_now' },
      { label: 'Remind me later', value: 'remind_later' },
      { label: 'Skip today', value: 'skip_today' }
    ]
  });
};
