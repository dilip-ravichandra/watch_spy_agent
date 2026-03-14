const { getDb, ensureSchema } = require('../_lib/db');
const { json } = require('../_lib/utils');
const { requireAuthenticatedUser } = require('../_lib/auth-guard');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, json);
  if (!authUser) return;

  await ensureSchema();
  const db = await getDb();
  if (!db) return json(res, 500, { error: 'MongoDB is not configured' });

  const userId = authUser.userId;
  const deviceType = String(req.query.deviceType || '');

  const query = {
    userId,
    status: { $in: ['PENDING', 'SENT', 'DELIVERED'] }
  };
  if (deviceType) query.deviceType = deviceType;

  const rows = await db
    .collection('notification_queue')
    .find(query)
    .sort({ _id: -1 })
    .limit(50)
    .toArray();

  return json(res, 200, {
    userId,
    count: rows.length,
    notifications: rows.map((r) => ({
      notificationId: String(r._id),
      deviceType: r.deviceType,
      channel: r.channel,
      scheduledTime: r.scheduledTime,
      suggestedAction: r.suggestedAction,
      suggestedDestination: r.suggestedDestination,
      message: r.reminderMessage,
      status: r.status,
      responseOption: r.responseOption,
      sentAt: r.sentAt
    }))
  });
};
