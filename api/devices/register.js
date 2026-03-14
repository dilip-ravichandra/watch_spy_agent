const { getDb, ensureSchema } = require('../_lib/db');
const { json, parseBody, nowIso } = require('../_lib/utils');
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
  const deviceType = String(body.deviceType || 'mobile');
  const platform = String(body.platform || 'generic');
  const hookUrl = String(body.hookUrl || '');
  const pushToken = String(body.pushToken || '');
  const enabled = body.enabled !== false;
  const now = nowIso();

  await db.collection('device_hooks').updateOne(
    { userId, deviceType, platform },
    {
      $set: {
        hookUrl,
        pushToken,
        enabled,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true }
  );

  return json(res, 200, {
    success: true,
    userId,
    deviceType,
    platform,
    hookRegistered: hookUrl.length > 0,
    pollingAvailableAt: `/api/notifications/pending?userId=${encodeURIComponent(userId)}&deviceType=${encodeURIComponent(deviceType)}`,
    message: 'Your device hook has been saved. I will use it for scheduled reminders.'
  });
};
