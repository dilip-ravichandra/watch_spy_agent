# Chrono — Watch Habit AI Assistant

A polished full-stack assistant for watch enthusiasts with secure auth, habit intelligence, chatbot support, location-aware insights, calendar planning, and MongoDB persistence.

---

## ✨ Highlights

- 🔐 **Production-style auth** with session cookies, CSRF, and server-side route guards
- 🤖 **AI chat assistant** with routine-aware coaching and smart quick options
- 📅 **Calendar center** with create/update/delete events (birthdays, reminders, personal plans)
- 🗺️ **Live map + geolocation** and frequent-place learning
- 📬 **Email-ready reminders** and forgot-password flow
- 🔌 **Integration-ready architecture** (MuleSoft + safe local mock fallback)
- 🧠 **Daily insights** from behavior, location, and check-ins

---

## 🧱 Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS
- **Backend:** Node.js (`local-server.js`) with API route handlers
- **Database:** MongoDB (`mongodb`)
- **Mail:** Nodemailer (`nodemailer`)
- **AI Provider:** Groq (optional, with local fallback)

---

## 📂 Project Structure

- Main UI: [index.html](index.html)
- Auth UI: [auth.html](auth.html)
- Local API server: [local-server.js](local-server.js)
- Core libs: [api/_lib](api/_lib)
- Auth routes: [api/auth](api/auth)
- Assistant routes: [api/assistant](api/assistant)
- Calendar routes: [api/calendar](api/calendar)
- Integration routes: [api/integrations](api/integrations)
- Location routes: [api/location](api/location)

---

## 🔐 Authentication & Security

- HttpOnly session cookie (`chrono_session`)
- CSRF protection on auth write operations
- Rate limiting for login/signup flows
- Server-side auth enforcement for protected APIs
- Direct navigation hardening: unauthenticated `/index.html` is redirected to `/auth.html`
- Delayed redirect UX (~1.5s) for smoother login/home transitions

---

## 📅 Calendar Features

The app includes a MongoDB-backed event calendar:

- View events by month/day
- Add custom events with date and time
- Edit existing events
- Delete events
- Quick actions for family reminders (e.g., mom/sister birthdays)
- Events persist in `calendar_events` collection

Primary calendar endpoint:

- `GET|POST|PUT|DELETE /api/calendar/events`

---

## 🤖 Assistant Capabilities

- Friendly check-ins throughout the day
- Quick answer capture for routine learning
- Daily summary insight generation
- Habit-aware nudges and recommendations
- Calendar + weather + transport awareness

---

## 🔌 Integrations Architecture

Integration routes are routed through a MuleSoft client layer.

If MuleSoft is not configured, the app gracefully returns **mock responses** so local development stays stable.

Included integration groups:

- Maps
- Calendar
- Weather
- Transport
- Notifications
- Voice
- Email

---

## 🚀 Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Copy [.env.example](.env.example) to `.env.local` and fill required values.

### 3) Start app

```bash
npm run dev
```

### 4) Open in browser

- Auth page: http://localhost:3000/auth.html
- App page: http://localhost:3000/index.html

---

## 🧪 Core API Surface

### System
- `GET /api/health`

### Auth
- `GET /api/auth/csrf`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password-request`
- `POST /api/auth/reset-password`

### Habit + Assistant
- `POST /api/track`
- `GET /api/reminder`
- `POST /api/chat`
- `GET /api/assistant/question`
- `POST /api/assistant/answer`
- `GET /api/assistant/daily-insight`

### Calendar
- `GET /api/calendar/events`
- `POST /api/calendar/events`
- `PUT /api/calendar/events`
- `DELETE /api/calendar/events`

### Location
- `POST /api/location/update`
- `GET /api/location/history`
- `GET /api/location/frequent-places`

### Integrations
- `GET /api/integrations/maps/traffic`
- `GET /api/integrations/calendar/upcoming`
- `POST /api/integrations/calendar/create-reminder`
- `GET /api/integrations/weather/current`
- `GET /api/integrations/transport/options`
- `POST /api/integrations/notifications/send`
- `POST /api/integrations/email/send-reminder`
- `POST /api/integrations/email/send-daily-summary`
- `POST /api/integrations/voice/interpret`

### Cron/Dispatch
- `GET /api/cron/dispatch-reminders`

Compatibility aliases:

- `POST /api/habits/track` → `/api/track`
- `GET /api/reminders` → `/api/reminder`

---

## ⚙️ Environment Variables

See [.env.example](.env.example).

Important keys:

- `MONGODB_URI`, `MONGODB_DB`
- `AI_ENABLED`, `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_API_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- `APP_BASE_URL`, `RESET_TOKEN_TTL_MINUTES`
- `MULESOFT_BASE_URL`, `MULESOFT_CLIENT_ID`, `MULESOFT_CLIENT_SECRET`
- Optional direct integration keys: maps/calendar/weather/transport/push

---

## 🛡️ Notes

- Never commit real secrets to Git.
- Use `.env.local` for real keys.
- Rotate credentials immediately if exposed.

---

## 📜 License

Add your preferred license in this repository if needed.
