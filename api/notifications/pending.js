const { sql, ensureSchema } = require('../_lib/db');
const { json, userIdFrom } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  await ensureSchema();

  const userId = userIdFrom(req, {});
  const deviceType = String(req.query.deviceType || '');

  const rows = await sql`
    SELECT id AS notification_id,
           user_id,
           device_type,
           channel,
           scheduled_time,
           suggested_action,
           suggested_destination,
           reminder_message,
           status,
           response_option,
           sent_at
    FROM notification_queue
    WHERE user_id = ${userId}
      AND (${deviceType} = '' OR device_type = ${deviceType})
      AND status IN ('PENDING', 'SENT', 'DELIVERED')
    ORDER BY id DESC
    LIMIT 50
  `;

  return json(res, 200, {
    userId,
    count: rows.rows.length,
    notifications: rows.rows.map((r) => ({
      notificationId: r.notification_id,
      deviceType: r.device_type,
      channel: r.channel,
      scheduledTime: r.scheduled_time,
      suggestedAction: r.suggested_action,
      suggestedDestination: r.suggested_destination,
      message: r.reminder_message,
      status: r.status,
      responseOption: r.response_option,
      sentAt: r.sent_at
    }))
  });
};
