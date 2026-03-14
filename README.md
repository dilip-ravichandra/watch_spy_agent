# Watch Spy Agent Lite

This is a clean restart with a small frontend and backend.

## What is included

- Minimal web UI: [index.html](index.html)
- Auth UI: [auth.html](auth.html)
- Small API set:
  - [api/health.js](api/health.js)
  - [api/track.js](api/track.js)
  - [api/reminder.js](api/reminder.js)
  - [api/chat.js](api/chat.js)
  - [api/auth/signup.js](api/auth/signup.js)
  - [api/auth/login.js](api/auth/login.js)
  - [api/auth/me.js](api/auth/me.js)
- Optional MongoDB persistence with memory fallback:
  - [api/_lib/store.js](api/_lib/store.js)

## API endpoints

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password-request`
- `POST /api/auth/reset-password`
- `GET /api/auth/me` (Bearer token)
- `POST /api/track`
- `GET /api/reminder`
- `POST /api/chat`
- `GET /api/assistant/question`
- `POST /api/assistant/answer`
- `GET /api/assistant/daily-insight`
- `POST /api/location/update`
- `GET /api/location/history`
- `GET /api/location/frequent-places`
- `GET /api/integrations/maps/traffic`
- `GET /api/integrations/calendar/upcoming`
- `POST /api/integrations/calendar/create-reminder`
- `GET /api/integrations/weather/current`
- `GET /api/integrations/transport/options`
- `POST /api/integrations/notifications/send`
- `POST /api/integrations/email/send-reminder`
- `POST /api/integrations/email/send-daily-summary`
- `POST /api/integrations/voice/interpret`
- `GET /api/cron/dispatch-reminders`

Auth protections included:

- HttpOnly session cookie
- CSRF protection for auth writes
- Rate limiting on signup and login
- App data routes bind to the authenticated session user server-side

Assistant features included:

- Friendly chatbot check-ins (5-6 daily slots)
- Random routine-learning questions with persistent answer storage
- Location history persistence and frequent place detection
- Daily insight summary generation from activity, location, and responses
- Map panel on the UI with browser geolocation + backend location logging

Integration architecture:

- External services are orchestrated through a MuleSoft integration layer
- MuleSoft-ready adapters are available for maps, calendar, weather, transport, notifications, and voice
- If MuleSoft is not configured, endpoints return safe mock responses so local development stays functional

Compatibility aliases are also available locally:

- `POST /api/habits/track` -> `/api/track`
- `GET /api/reminders` -> `/api/reminder`

## Local run

1. Install dependencies
2. Copy `.env.example` to `.env.local`
3. Start server:
   - `npm run dev`
4. Open:
  - `http://localhost:3000` (auth page)
  - `http://localhost:3000/index.html` (main app)

## Environment variables

See [.env.example](.env.example).

- `MONGODB_URI` (optional)
- `MONGODB_DB` (optional)
- `AI_ENABLED` (optional)
- `GROQ_API_KEY` (optional)
- `GROQ_MODEL` (optional)
- `GROQ_API_URL` (optional)
- `MULESOFT_BASE_URL`, `MULESOFT_CLIENT_ID`, `MULESOFT_CLIENT_SECRET` (integration orchestration)
- `GOOGLE_MAPS_API_KEY` (optional browser map embed)
- `FCM_SERVER_KEY` (optional if direct push is used)
- `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` (optional direct calendar mode)
- `WEATHER_API_KEY`, `TRANSPORT_API_KEY` (optional direct integrations)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (for forgot password)
- `APP_BASE_URL`, `RESET_TOKEN_TTL_MINUTES` (forgot password link settings)

If `MONGODB_URI` is not set, in-memory storage is used.
If AI config is missing, chat uses a local fallback response.
