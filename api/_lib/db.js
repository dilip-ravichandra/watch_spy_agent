const { sql } = require('@vercel/postgres');

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;

  await sql`
    CREATE TABLE IF NOT EXISTS habit_events (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp_iso TEXT NOT NULL,
      hour_of_day INT NOT NULL,
      location TEXT,
      destination TEXT,
      action TEXT,
      notes TEXT,
      source TEXT,
      created_at TEXT NOT NULL
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_habit_events_user_hour ON habit_events (user_id, hour_of_day);`;

  await sql`
    CREATE TABLE IF NOT EXISTS chat_history (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      message_role TEXT NOT NULL,
      message_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history (user_id, id);`;

  await sql`
    CREATE TABLE IF NOT EXISTS device_hooks (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_type TEXT NOT NULL,
      platform TEXT NOT NULL,
      hook_url TEXT,
      push_token TEXT,
      enabled BOOLEAN DEFAULT TRUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, device_type, platform)
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_device_hooks_user ON device_hooks (user_id, enabled);`;

  await sql`
    CREATE TABLE IF NOT EXISTS notification_queue (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_type TEXT NOT NULL,
      channel TEXT NOT NULL,
      reminder_slot TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      suggested_action TEXT,
      suggested_destination TEXT,
      reminder_message TEXT,
      delivery_payload TEXT,
      status TEXT NOT NULL,
      response_option TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_notification_queue_user_status ON notification_queue (user_id, status, device_type);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notification_queue_slot ON notification_queue (user_id, reminder_slot, device_type);`;

  schemaReady = true;
}

module.exports = { sql, ensureSchema };
