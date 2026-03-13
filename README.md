# Kind Watch Assistant (Vercel + Groq)

This workspace now includes a Vercel-ready serverless API for your watch reminder assistant with:

- persistent Postgres storage
- Groq AI chat integration
- scheduled reminder dispatch (Vercel Cron)
- watch/mobile notification hook APIs

## Main API endpoints

- `POST /api/habits/track` stores location and time habits in the database
- `GET /api/reminders` builds a gentle reminder from learned hourly patterns
- `POST /api/chat` stores chat history and can call an external AI model
- `POST /api/devices/register` registers watch/mobile hook endpoints or push tokens
- `GET /api/notifications/pending` returns queued reminders for devices
- `POST /api/notifications/ack` records user actions on reminders
- `GET /api/cron/dispatch-reminders` dispatches scheduled reminders (called by Vercel Cron)
- `GET /api/health` reports feature status

## Vercel structure

- [vercel.json](vercel.json)
- [package.json](package.json)
- [.env.example](.env.example)
- [api/health.js](api/health.js)
- [api/habits/track.js](api/habits/track.js)
- [api/reminders.js](api/reminders.js)
- [api/chat.js](api/chat.js)
- [api/devices/register.js](api/devices/register.js)
- [api/notifications/pending.js](api/notifications/pending.js)
- [api/notifications/ack.js](api/notifications/ack.js)
- [api/cron/dispatch-reminders.js](api/cron/dispatch-reminders.js)

## Storage model

The API persists data in Postgres (Vercel Postgres).

Tables created automatically:

- `habit_events`
- `chat_history`
- `device_hooks`
- `notification_queue`

## AI integration (Groq)

Configure these env vars (see [.env.example](.env.example)):

- `AI_ENABLED=true`
- `GROQ_API_KEY=...`
- `GROQ_MODEL=llama-3.1-8b-instant` (or any Groq chat model)
- `GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions`

If AI is disabled or key is missing, the API automatically uses local fallback replies.

## Scheduled reminders

Vercel Cron calls `/api/cron/dispatch-reminders` every 15 minutes.

The cron endpoint:

1. finds users with enabled devices
2. learns likely action/destination for current hour
3. queues notifications
4. optionally dispatches webhook calls when `NOTIFICATIONS_DISPATCH_ENABLED=true`

Use `CRON_SECRET` to protect the cron endpoint.

## Example API payloads

### Track a habit

```json
{
  "userId": "alex",
  "timestamp": "2026-03-13T08:00:00+05:30",
  "location": "home",
  "destination": "office",
  "action": "leave for work",
  "notes": "weekday commute",
  "source": "watch"
}
```

### Chat with the assistant

```json
{
  "userId": "alex",
  "timestamp": "2026-03-13T08:15:00+05:30",
  "currentLocation": "home",
  "message": "What should I do now?"
}
```

### Register a device hook

```json
{
  "userId": "alex",
  "deviceType": "watch",
  "platform": "wearos",
  "hookUrl": "https://example.com/watch-hook",
  "pushToken": "optional-device-token",
  "enabled": true
}
```

### Acknowledge a notification

```json
{
  "notificationId": 1,
  "userId": "alex",
  "status": "ACKNOWLEDGED",
  "responseOption": "remind_later"
}
```

## Deploy on Vercel

1. Push this folder to GitHub.
2. Import project in Vercel.
3. Add env vars from [.env.example](.env.example).
4. Create/attach Vercel Postgres so `POSTGRES_URL` is set.
5. Deploy.

Local dev:

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill values.
3. `npm run dev`

## Notes

- DB schema is auto-created on first API call.
- If Groq is unavailable, chat continues with local fallback.
- If webhook dispatch is disabled, notifications remain in pending queue for client polling.
