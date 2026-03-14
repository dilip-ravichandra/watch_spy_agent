const { MongoClient } = require('mongodb');

let schemaReady = false;
let cachedClient = null;
let cachedDb = null;

async function getDb() {
  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) return null;

  if (!cachedDb) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
    cachedDb = cachedClient.db(process.env.MONGODB_DB || 'watch_spy_agent');
  }

  return cachedDb;
}

async function ensureSchema() {
  if (schemaReady) return;

  const db = await getDb();
  if (!db) {
    schemaReady = true;
    return;
  }

  await db.collection('events').createIndexes([
    { key: { userId: 1, hourOfDay: 1, createdAt: -1 }, name: 'idx_events_user_hour_created' }
  ]);

  await db.collection('chats').createIndexes([
    { key: { userId: 1, createdAt: -1 }, name: 'idx_chats_user_created' }
  ]);

  await db.collection('device_hooks').createIndexes([
    { key: { userId: 1, deviceType: 1, platform: 1 }, unique: true, name: 'uniq_device_hooks_user_type_platform' },
    { key: { userId: 1, enabled: 1 }, name: 'idx_device_hooks_user_enabled' }
  ]);

  await db.collection('notification_queue').createIndexes([
    { key: { userId: 1, status: 1, deviceType: 1 }, name: 'idx_notification_user_status_device' },
    { key: { userId: 1, reminderSlot: 1, deviceType: 1 }, name: 'idx_notification_slot' },
    { key: { createdAt: -1 }, name: 'idx_notification_created' }
  ]);

  await db.collection('calendar_events').createIndexes([
    { key: { userId: 1, startTime: 1 }, name: 'idx_calendar_user_start' },
    { key: { userId: 1, dateKey: 1 }, name: 'idx_calendar_user_date' },
    { key: { userId: 1, updatedAt: -1 }, name: 'idx_calendar_user_updated' }
  ]);

  schemaReady = true;
}

module.exports = { getDb, ensureSchema };
