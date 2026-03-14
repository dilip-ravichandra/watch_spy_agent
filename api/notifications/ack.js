const { ObjectId } = require('mongodb');
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
  const notificationId = String(body.notificationId || '').trim();
  const responseOption = String(body.responseOption || 'acknowledged');
  const status = String(body.status || 'ACKNOWLEDGED');

  if (!notificationId) return json(res, 400, { error: 'notificationId is required' });

  if (!ObjectId.isValid(notificationId)) {
    return json(res, 400, { error: 'Invalid notificationId' });
  }

  const result = await db.collection('notification_queue').updateOne(
    { _id: new ObjectId(notificationId), userId },
    {
      $set: {
        status,
        responseOption,
        sentAt: nowIso()
      }
    }
  );

  return json(res, 200, {
    success: (result.modifiedCount || 0) > 0,
    notificationId,
    status,
    responseOption,
    message: 'Thank you. I saved your response so future reminders can feel more personal.'
  });
};
