function nowIso() {
  return new Date().toISOString();
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function userIdFrom(req, body = {}) {
  return String(body.userId || req.headers['x-user-id'] || req.query.userId || 'default-user');
}

function safeHour(timestamp) {
  const d = new Date(timestamp || nowIso());
  if (Number.isNaN(d.getTime())) return new Date().getUTCHours();
  return d.getUTCHours();
}

function rankBy(items, key, fallback) {
  const counts = new Map();
  for (const item of items || []) {
    const value = String(item?.[key] ?? fallback);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function buildSuggestion(events, timestamp, currentLocation = 'unknown') {
  const hour = safeHour(timestamp);
  const matching = (events || []).filter((e) => safeHour(e.timestamp_iso || e.timestamp) === hour);
  const actions = rankBy(matching, 'action', 'check your plan');
  const destinations = rankBy(matching, 'destination', currentLocation);

  const suggestedAction = actions[0]?.name || 'check your plan';
  const suggestedDestination = destinations[0]?.name || currentLocation;

  let message = 'Hi, I am still learning about you. Please keep sharing your routine with me.';
  if ((events || []).length > 0) {
    if (suggestedDestination !== 'unknown' && suggestedDestination !== currentLocation) {
      message = `Hi, it is around the time you usually go to ${suggestedDestination}. Would you like to head there now?`;
    } else {
      message = `Hi, this is the hour when you often ${suggestedAction}. Would you like a gentle reminder?`;
    }
  }

  return {
    learnedFromEvents: (events || []).length,
    suggestedAction,
    suggestedDestination,
    message
  };
}

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

module.exports = {
  nowIso,
  parseBody,
  userIdFrom,
  safeHour,
  rankBy,
  buildSuggestion,
  json
};
