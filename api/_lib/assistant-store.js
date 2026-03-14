const { getDb } = require('./db');
const { QUESTION_POOL, DAILY_PROMPT_SLOTS } = require('./assistant-question-pool');

let indexesReady = false;

function nowIso() {
  return new Date().toISOString();
}

function roundCoord(value, precision = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const p = Math.pow(10, precision);
  return Math.round(n * p) / p;
}

async function ensureAssistantIndexes() {
  if (indexesReady) return;
  const db = await getDb();
  if (!db) return;

  await db.collection('assistant_answers').createIndexes([
    { key: { userId: 1, createdAt: -1 }, name: 'idx_assistant_answers_user_time' },
    { key: { userId: 1, slotKey: 1 }, name: 'idx_assistant_answers_user_slot' }
  ]);

  await db.collection('location_history').createIndexes([
    { key: { userId: 1, recordedAt: -1 }, name: 'idx_location_user_time' },
    { key: { userId: 1, clusterKey: 1 }, name: 'idx_location_user_cluster' }
  ]);

  await db.collection('activity_logs').createIndexes([
    { key: { userId: 1, createdAt: -1 }, name: 'idx_activity_user_time' },
    { key: { type: 1, createdAt: -1 }, name: 'idx_activity_type_time' }
  ]);

  indexesReady = true;
}

async function addActivityLog({ userId, type, detail, severity = 'info' }) {
  const db = await getDb();
  if (!db) return;
  await ensureAssistantIndexes();

  await db.collection('activity_logs').insertOne({
    userId: String(userId || ''),
    type: String(type || 'event'),
    detail: detail || {},
    severity: String(severity || 'info'),
    createdAt: nowIso()
  });
}

async function saveLocationPoint({ userId, latitude, longitude, accuracy, source = 'manual', label = '' }) {
  const db = await getDb();
  if (!db) return { ok: false, error: 'MongoDB is not configured' };
  await ensureAssistantIndexes();

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: 'Invalid latitude/longitude' };
  }

  const rLat = roundCoord(lat, 3);
  const rLng = roundCoord(lng, 3);
  const clusterKey = `${rLat},${rLng}`;

  const doc = {
    userId,
    latitude: lat,
    longitude: lng,
    accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
    source: String(source || 'manual'),
    label: String(label || ''),
    clusterKey,
    recordedAt: nowIso()
  };

  await db.collection('location_history').insertOne(doc);
  await addActivityLog({ userId, type: 'location.update', detail: { latitude: lat, longitude: lng, source } });
  return { ok: true, location: doc };
}

async function getLocationHistory(userId, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  await ensureAssistantIndexes();

  return db.collection('location_history')
    .find({ userId: String(userId) })
    .sort({ _id: -1 })
    .limit(Number(limit || 100))
    .toArray();
}

function classifyPlace(label) {
  const v = String(label || '').toLowerCase();
  if (/home|house|residence/.test(v)) return 'home';
  if (/office|work|company/.test(v)) return 'work';
  if (/gym|fitness/.test(v)) return 'gym';
  if (/school|college|university|campus/.test(v)) return 'education';
  return 'frequent_place';
}

async function detectFrequentPlaces(userId, minVisits = 3) {
  const db = await getDb();
  if (!db) return [];
  await ensureAssistantIndexes();

  const rows = await db.collection('location_history').aggregate([
    { $match: { userId: String(userId) } },
    {
      $group: {
        _id: '$clusterKey',
        visits: { $sum: 1 },
        avgLat: { $avg: '$latitude' },
        avgLng: { $avg: '$longitude' },
        lastSeen: { $max: '$recordedAt' },
        labels: { $push: '$label' }
      }
    },
    { $match: { visits: { $gte: Number(minVisits || 3) } } },
    { $sort: { visits: -1 } },
    { $limit: 20 }
  ]).toArray();

  return rows.map((r) => {
    const label = (r.labels || []).find((x) => String(x || '').trim()) || 'Frequent place';
    return {
      clusterKey: r._id,
      visits: r.visits,
      latitude: r.avgLat,
      longitude: r.avgLng,
      lastSeen: r.lastSeen,
      label,
      type: classifyPlace(label)
    };
  });
}

function daySlotKey(date, hour) {
  const d = new Date(date || Date.now());
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}:${String(hour).padStart(2, '0')}`;
}

function pickQuestion(excludeIds = []) {
  const available = QUESTION_POOL.filter((q) => !excludeIds.includes(q.id));
  const source = available.length ? available : QUESTION_POOL;
  return source[Math.floor(Math.random() * source.length)];
}

async function getDueAssistantQuestion(userId, now = new Date()) {
  const db = await getDb();
  if (!db) return null;
  await ensureAssistantIndexes();

  const currentHour = now.getHours();
  const slotHour = DAILY_PROMPT_SLOTS.find((h) => h >= currentHour);
  const selectedSlot = slotHour ?? DAILY_PROMPT_SLOTS[DAILY_PROMPT_SLOTS.length - 1];
  const slotKey = daySlotKey(now, selectedSlot);

  const existing = await db.collection('assistant_answers').findOne({ userId: String(userId), slotKey });
  if (existing) return null;

  const recent = await db.collection('assistant_answers')
    .find({ userId: String(userId) })
    .sort({ _id: -1 })
    .limit(6)
    .toArray();

  const exclude = recent.map((r) => r.questionId).filter(Boolean);
  const q = pickQuestion(exclude);
  return {
    slotKey,
    scheduledHour: selectedSlot,
    question: q
  };
}

async function saveAssistantAnswer({ userId, slotKey, questionId, questionText, answer, selectedOption, context }) {
  const db = await getDb();
  if (!db) return { ok: false, error: 'MongoDB is not configured' };
  await ensureAssistantIndexes();

  const doc = {
    userId: String(userId),
    slotKey: String(slotKey || ''),
    questionId: String(questionId || ''),
    questionText: String(questionText || ''),
    answer: String(answer || ''),
    selectedOption: String(selectedOption || ''),
    context: context || {},
    createdAt: nowIso()
  };

  await db.collection('assistant_answers').insertOne(doc);
  await addActivityLog({ userId, type: 'assistant.answer', detail: { questionId, selectedOption } });
  return { ok: true, answer: doc };
}

async function getDailyInsight(userId, date = new Date()) {
  const db = await getDb();
  if (!db) return null;
  await ensureAssistantIndexes();

  const d = new Date(date);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59));

  const [locations, answers, events] = await Promise.all([
    db.collection('location_history').find({
      userId: String(userId),
      recordedAt: { $gte: start.toISOString(), $lte: end.toISOString() }
    }).toArray(),
    db.collection('assistant_answers').find({
      userId: String(userId),
      createdAt: { $gte: start.toISOString(), $lte: end.toISOString() }
    }).toArray(),
    db.collection('events').find({
      userId: String(userId),
      createdAt: { $gte: start.toISOString(), $lte: end.toISOString() }
    }).toArray()
  ]);

  const byCluster = new Map();
  for (const l of locations) {
    byCluster.set(l.clusterKey, (byCluster.get(l.clusterKey) || 0) + 1);
  }

  const topPlaces = [...byCluster.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([clusterKey, visits]) => ({ clusterKey, visits }));

  const summary = `Today you logged ${events.length} routine event(s), answered ${answers.length} assistant check-in(s), and visited ${topPlaces.length || 0} frequent place cluster(s). Great consistency.`;

  return {
    date: start.toISOString().slice(0, 10),
    eventsCount: events.length,
    answersCount: answers.length,
    topPlaces,
    summary
  };
}

module.exports = {
  ensureAssistantIndexes,
  addActivityLog,
  saveLocationPoint,
  getLocationHistory,
  detectFrequentPlaces,
  getDueAssistantQuestion,
  saveAssistantAnswer,
  getDailyInsight
};
