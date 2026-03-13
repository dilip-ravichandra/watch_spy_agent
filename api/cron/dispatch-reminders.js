const { sql, ensureSchema } = require('../_lib/db');
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

  const notificationsEnabled = String(process.env.NOTIFICATIONS_DISPATCH_ENABLED || 'false') === 'true';

  const users = await sql`
    SELECT DISTINCT user_id
    FROM device_hooks
    WHERE enabled = TRUE
  `;

  const reminderSlot = nowIso().slice(0, 13); // YYYY-MM-DDTHH
  const currentHour = safeHour(nowIso());

  let queued = 0;
  let delivered = 0;

  for (const u of users.rows) {
    const userId = u.user_id;

    const [events, hooks] = await Promise.all([
      sql`
        SELECT timestamp_iso, location, destination, action
        FROM habit_events
        WHERE user_id = ${userId}
          AND hour_of_day = ${currentHour}
        ORDER BY id DESC
        LIMIT 100
      `,
      sql`
        SELECT device_type, platform, hook_url, push_token, enabled
        FROM device_hooks
        WHERE user_id = ${userId}
          AND enabled = TRUE
      `
    ]);

    if (!events.rows.length || !hooks.rows.length) continue;

    const actions = rankBy(events.rows, 'action', 'check your plan');
    const destinations = rankBy(events.rows, 'destination', 'unknown');
    const suggestedAction = actions[0]?.name || 'check your plan';
    const suggestedDestination = destinations[0]?.name || 'unknown';

    const reminderMessage =
      suggestedDestination !== 'unknown'
        ? `Hi, this is your gentle reminder. Around this time you usually ${suggestedAction} and often head to ${suggestedDestination}.`
        : `Hi, this is your gentle reminder. Around this time you usually ${suggestedAction}.`;

    for (const hook of hooks.rows) {
      const deviceType = hook.device_type || 'mobile';

      const exists = await sql`
        SELECT COUNT(*)::int AS total_count
        FROM notification_queue
        WHERE user_id = ${userId}
          AND device_type = ${deviceType}
          AND reminder_slot = ${reminderSlot}
          AND status IN ('PENDING', 'SENT', 'DELIVERED')
      `;

      if ((exists.rows[0]?.total_count || 0) > 0) continue;

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

      const inserted = await sql`
        INSERT INTO notification_queue (user_id, device_type, channel, reminder_slot, scheduled_time, suggested_action, suggested_destination, reminder_message, delivery_payload, status, response_option, created_at, sent_at)
        VALUES (
          ${userId},
          ${deviceType},
          ${(hook.hook_url || '').length ? 'webhook' : 'inbox'},
          ${reminderSlot},
          ${nowIso()},
          ${suggestedAction},
          ${suggestedDestination},
          ${reminderMessage},
          ${JSON.stringify(payload)},
          ${'PENDING'},
          ${null},
          ${nowIso()},
          ${null}
        )
        RETURNING id
      `;

      queued += 1;
      const notificationId = inserted.rows[0]?.id;

      if (notificationsEnabled && hook.hook_url) {
        try {
          const resp = await fetch(String(hook.hook_url), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, notificationId })
          });

          if (resp.ok) {
            delivered += 1;
            await sql`
              UPDATE notification_queue
              SET status = 'DELIVERED', sent_at = ${nowIso()}
              WHERE id = ${notificationId}
            `;
          } else {
            await sql`
              UPDATE notification_queue
              SET status = 'FAILED', sent_at = ${nowIso()}
              WHERE id = ${notificationId}
            `;
          }
        } catch {
          await sql`
            UPDATE notification_queue
            SET status = 'FAILED', sent_at = ${nowIso()}
            WHERE id = ${notificationId}
          `;
        }
      }
    }
  }

  return json(res, 200, {
    ok: true,
    usersScanned: users.rows.length,
    queued,
    delivered,
    dispatchEnabled: notificationsEnabled,
    reminderSlot
  });
};
