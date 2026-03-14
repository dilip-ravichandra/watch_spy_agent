const { MongoClient } = require('mongodb');

const memory = {
  events: [],
  chats: []
};

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (!cachedDb) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
    cachedDb = cachedClient.db(process.env.MONGODB_DB || 'watch_spy_agent');
  }

  return cachedDb;
}

function nowIso() {
  return new Date().toISOString();
}

function getHour(ts) {
  const d = new Date(ts || nowIso());
  return Number.isNaN(d.getTime()) ? new Date().getUTCHours() : d.getUTCHours();
}

async function saveEvent(event) {
  const db = await getDb();
  const data = {
    userId: String(event.userId || 'default-user'),
    timestamp: String(event.timestamp || nowIso()),
    location: String(event.location || 'unknown'),
    destination: String(event.destination || event.location || 'unknown'),
    action: String(event.action || 'check plan'),
    note: String(event.note || ''),
    createdAt: nowIso()
  };

  if (db) {
    await db.collection('events').insertOne(data);
  } else {
    memory.events.push(data);
  }

  return data;
}

async function getEventsByUser(userId, limit = 500) {
  const db = await getDb();
  if (db) {
    return db
      .collection('events')
      .find({ userId: String(userId) })
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();
  }

  return memory.events.filter((e) => e.userId === String(userId)).slice(-limit).reverse();
}

async function saveChat(userId, role, message) {
  const db = await getDb();
  const doc = {
    userId: String(userId || 'default-user'),
    role: role === 'assistant' ? 'assistant' : 'user',
    message: String(message || ''),
    createdAt: nowIso()
  };

  if (db) {
    await db.collection('chats').insertOne(doc);
  } else {
    memory.chats.push(doc);
  }
}

async function getRecentChats(userId, limit = 10) {
  const db = await getDb();
  if (db) {
    return db
      .collection('chats')
      .find({ userId: String(userId) })
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();
  }

  return memory.chats.filter((c) => c.userId === String(userId)).slice(-limit).reverse();
}

function buildSuggestion(events, timestamp, currentLocation = 'unknown') {
  const hour = getHour(timestamp);
  const sameHour = (events || []).filter((e) => getHour(e.timestamp) === hour);

  const countBy = (key, fallback) => {
    const m = new Map();
    for (const item of sameHour) {
      const value = String(item?.[key] || fallback);
      m.set(value, (m.get(value) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const actions = countBy('action', 'check plan');
  const destinations = countBy('destination', currentLocation);

  const suggestedAction = actions[0]?.[0] || 'check plan';
  const suggestedDestination = destinations[0]?.[0] || currentLocation;

  const message =
    events.length === 0
      ? 'Hi, I am learning your routine. Add a few tracking events first.'
      : suggestedDestination !== 'unknown' && suggestedDestination !== currentLocation
        ? `Hi, around this time you usually go to ${suggestedDestination}.`
        : `Hi, around this time you usually ${suggestedAction}.`;

  return {
    learnedFromEvents: events.length,
    suggestedAction,
    suggestedDestination,
    message
  };
}

async function storageMode() {
  return (await getDb()) ? 'mongodb' : 'memory';
}

module.exports = {
  nowIso,
  getHour,
  saveEvent,
  getEventsByUser,
  saveChat,
  getRecentChats,
  buildSuggestion,
  storageMode
};
