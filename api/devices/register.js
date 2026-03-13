const { sql, ensureSchema } = require('../_lib/db');
const { json, parseBody, userIdFrom, nowIso } = require('../_lib/utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  await ensureSchema();

  const body = parseBody(req);
  const userId = userIdFrom(req, body);
  const deviceType = String(body.deviceType || 'mobile');
  const platform = String(body.platform || 'generic');
  const hookUrl = String(body.hookUrl || '');
  const pushToken = String(body.pushToken || '');
  const enabled = body.enabled !== false;
  const now = nowIso();

  await sql`
    INSERT INTO device_hooks (user_id, device_type, platform, hook_url, push_token, enabled, created_at, updated_at)
    VALUES (${userId}, ${deviceType}, ${platform}, ${hookUrl}, ${pushToken}, ${enabled}, ${now}, ${now})
    ON CONFLICT (user_id, device_type, platform)
    DO UPDATE SET
      hook_url = EXCLUDED.hook_url,
      push_token = EXCLUDED.push_token,
      enabled = EXCLUDED.enabled,
      updated_at = EXCLUDED.updated_at
  `;

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
