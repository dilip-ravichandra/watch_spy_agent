const { sql, ensureSchema } = require('../_lib/db');
const { json, parseBody, userIdFrom, nowIso } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  await ensureSchema();

  const body = parseBody(req);
  const userId = userIdFrom(req, body);
  const notificationId = Number(body.notificationId || 0);
  const responseOption = String(body.responseOption || 'acknowledged');
  const status = String(body.status || 'ACKNOWLEDGED');

  if (!notificationId) return json(res, 400, { error: 'notificationId is required' });

  const result = await sql`
    UPDATE notification_queue
    SET status = ${status},
        response_option = ${responseOption},
        sent_at = ${nowIso()}
    WHERE id = ${notificationId}
      AND user_id = ${userId}
  `;

  return json(res, 200, {
    success: (result.rowCount || 0) > 0,
    notificationId,
    status,
    responseOption,
    message: 'Thank you. I saved your response so future reminders can feel more personal.'
  });
};
