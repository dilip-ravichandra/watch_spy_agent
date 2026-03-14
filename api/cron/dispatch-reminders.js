const { getDb, ensureSchema } = require('../_lib/db');
const { nowIso, rankBy, safeHour, json } = require('../_lib/utils');

function checkCronAuth(req) {
  const expected = process.env.CRON_SECRET || '';
  if (!expected) return true;

  const bearer = String(req.headers.authorization || '');
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  return token === expected;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  if (!checkCronAuth(req)) return json(res, 401, { error: 'Unauthorized' });

  await ensureSchema();
  const db = await getDb();
  if (!db) return json(res, 500, { error: 'MongoDB is not configured' });

  const notificationsEnabled = String(process.env.NOTIFICATIONS_DISPATCH_ENABLED || 'false') === 'true';

  const hookUsers = await db
    .collection('device_hooks')
    .find({ enabled: true }, { projection: { userId: 1 } })
    .toArray();
  const userIds = [...new Set(hookUsers.map((h) => String(h.userId || '')).filter(Boolean))];

  const reminderSlot = nowIso().slice(0, 13); // YYYY-MM-DDTHH
  const currentHour = safeHour(nowIso());

  let queued = 0;
  let delivered = 0;

  for (const userId of userIds) {

    const [events, hooks] = await Promise.all([
      db
        .collection('events')
        .find({ userId })
        .sort({ _id: -1 })
        .limit(500)
        .toArray(),
      db
        .collection('device_hooks')
        .find({ userId, enabled: true })
        .toArray()
    ]);

    const hourlyEvents = (events || [])
      .filter((e) => safeHour(e.timestampIso || e.timestamp || e.timestamp_iso) === currentHour)
      .slice(0, 100)
      .map((e) => ({
        location: e.location,
        destination: e.destination,
        action: e.action
      }));

    if (!hourlyEvents.length || !hooks.length) continue;

    const actions = rankBy(hourlyEvents, 'action', 'check your plan');
    const destinations = rankBy(hourlyEvents, 'destination', 'unknown');
    const suggestedAction = actions[0]?.name || 'check your plan';
    const suggestedDestination = destinations[0]?.name || 'unknown';

    const reminderMessage =
      suggestedDestination !== 'unknown'
        ? `Hi, this is your gentle reminder. Around this time you usually ${suggestedAction} and often head to ${suggestedDestination}.`
        : `Hi, this is your gentle reminder. Around this time you usually ${suggestedAction}.`;

    for (const hook of hooks) {
      const deviceType = hook.deviceType || 'mobile';

      const existsCount = await db.collection('notification_queue').countDocuments({
        userId,
        deviceType,
        reminderSlot,
        status: { $in: ['PENDING', 'SENT', 'DELIVERED'] }
      });

      if (existsCount > 0) continue;

      const payload = {
        type: 'habit-reminder',
        userId,
        deviceType,
        message: reminderMessage,
        suggestedAction,
        suggestedDestination,
        options: [
          { label: 'Remind me now', value: 'remind_now' },
          { label: 'Remind me later', value: 'remind_later' },
          { label: 'Skip today', value: 'skip_today' }
        ],
        scheduledTime: nowIso()
      };

      const inserted = await db.collection('notification_queue').insertOne({
        userId,
        deviceType,
        channel: (hook.hookUrl || '').length ? 'webhook' : 'inbox',
        reminderSlot,
        scheduledTime: nowIso(),
        suggestedAction,
        suggestedDestination,
        reminderMessage,
        deliveryPayload: payload,
        status: 'PENDING',
        responseOption: null,
        createdAt: nowIso(),
        sentAt: null
      });

      queued += 1;
      const notificationId = inserted.insertedId;

      if (notificationsEnabled && hook.hookUrl) {
        try {
          const resp = await fetch(String(hook.hookUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, notificationId: String(notificationId) })
          });

          if (resp.ok) {
            delivered += 1;
            await db.collection('notification_queue').updateOne(
              { _id: notificationId },
              { $set: { status: 'DELIVERED', sentAt: nowIso() } }
            );
          } else {
            await db.collection('notification_queue').updateOne(
              { _id: notificationId },
              { $set: { status: 'FAILED', sentAt: nowIso() } }
            );
          }
        } catch {
          await db.collection('notification_queue').updateOne(
            { _id: notificationId },
            { $set: { status: 'FAILED', sentAt: nowIso() } }
          );
        }
      }
    }
  }

  return json(res, 200, {
    ok: true,
    usersScanned: userIds.length,
    queued,
    delivered,
    dispatchEnabled: notificationsEnabled,
    reminderSlot
  });
};
