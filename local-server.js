const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { readSessionToken } = require('./api/_lib/auth-cookie');
const { getUserByToken } = require('./api/_lib/auth-store');

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env.local');

const health = require('./api/health');
const track = require('./api/track');
const reminder = require('./api/reminder');
const chat = require('./api/chat');
const authSignup = require('./api/auth/signup');
const authLogin = require('./api/auth/login');
const authMe = require('./api/auth/me');
const authLogout = require('./api/auth/logout');
const authCsrf = require('./api/auth/csrf');
const authForgotPasswordRequest = require('./api/auth/forgot-password-request');
const authResetPassword = require('./api/auth/reset-password');
const devicesRegister = require('./api/devices/register');
const notificationsPending = require('./api/notifications/pending');
const notificationsAck = require('./api/notifications/ack');
const cronDispatchReminders = require('./api/cron/dispatch-reminders');
const assistantQuestion = require('./api/assistant/question');
const assistantAnswer = require('./api/assistant/answer');
const assistantDailyInsight = require('./api/assistant/daily-insight');
const locationUpdate = require('./api/location/update');
const locationHistory = require('./api/location/history');
const frequentPlaces = require('./api/location/frequent-places');
const mapsTraffic = require('./api/integrations/maps/traffic');
const calendarUpcoming = require('./api/integrations/calendar/upcoming');
const calendarCreateReminder = require('./api/integrations/calendar/create-reminder');
const weatherCurrent = require('./api/integrations/weather/current');
const transportOptions = require('./api/integrations/transport/options');
const notificationsSend = require('./api/integrations/notifications/send');
const emailSendReminder = require('./api/integrations/email/send-reminder');
const emailSendDailySummary = require('./api/integrations/email/send-daily-summary');
const voiceInterpret = require('./api/integrations/voice/interpret');
const publicConfig = require('./api/config/public');
const calendarEvents = require('./api/calendar/events');

const routes = {
  'GET /api/health': health,
  'GET /api/config/public': publicConfig,
  'GET /api/calendar/events': calendarEvents,
  'POST /api/calendar/events': calendarEvents,
  'PUT /api/calendar/events': calendarEvents,
  'DELETE /api/calendar/events': calendarEvents,
  'POST /api/track': track,
  'POST /api/habits/track': track,
  'GET /api/reminder': reminder,
  'GET /api/reminders': reminder,
  'POST /api/chat': chat,
  'POST /api/devices/register': devicesRegister,
  'GET /api/notifications/pending': notificationsPending,
  'POST /api/notifications/ack': notificationsAck,
  'GET /api/assistant/question': assistantQuestion,
  'POST /api/assistant/answer': assistantAnswer,
  'GET /api/assistant/daily-insight': assistantDailyInsight,
  'POST /api/location/update': locationUpdate,
  'GET /api/location/history': locationHistory,
  'GET /api/location/frequent-places': frequentPlaces,
  'GET /api/integrations/maps/traffic': mapsTraffic,
  'GET /api/integrations/calendar/upcoming': calendarUpcoming,
  'POST /api/integrations/calendar/create-reminder': calendarCreateReminder,
  'GET /api/integrations/weather/current': weatherCurrent,
  'GET /api/integrations/transport/options': transportOptions,
  'POST /api/integrations/notifications/send': notificationsSend,
  'POST /api/integrations/email/send-reminder': emailSendReminder,
  'POST /api/integrations/email/send-daily-summary': emailSendDailySummary,
  'POST /api/integrations/voice/interpret': voiceInterpret,
  'GET /api/cron/dispatch-reminders': cronDispatchReminders,
  'POST /api/auth/signup': authSignup,
  'POST /api/auth/login': authLogin,
  'POST /api/auth/forgot-password-request': authForgotPasswordRequest,
  'POST /api/auth/reset-password': authResetPassword,
  'GET /api/auth/me': authMe,
  'GET /api/auth/csrf': authCsrf,
  'POST /api/auth/logout': authLogout
};

function sendDelayedRedirectPage(res, toPath, message, delayMs = 1500) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Redirecting…</title></head><body style="font-family:Segoe UI,Arial,sans-serif;background:#0a0d14;color:#eef2ff;display:grid;place-items:center;min-height:100vh;margin:0"><div style="text-align:center"><h2 style="margin:0 0 8px">${message}</h2><p style="opacity:.8">Redirecting in ${Math.max(1, Math.round(delayMs / 1000))} second(s)…</p></div><script>setTimeout(function(){ window.location.replace(${JSON.stringify(toPath)}); }, ${Number(delayMs) || 1500});</script></body></html>`);
}

function contentTypeByExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function safeResolveStatic(pathname) {
  const requested = pathname === '/' ? '/auth.html' : pathname;
  const normalized = path.normalize(requested).replace(/^([/\\])+/, '');
  const absolute = path.join(process.cwd(), normalized);
  const root = process.cwd();
  if (!absolute.startsWith(root)) return null;
  return absolute;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve(undefined);
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(data);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:3000');
    const key = `${req.method} ${url.pathname}`;
    const handler = routes[key];

    // Vercel-style helpers expected by handlers
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };

    req.query = Object.fromEntries(url.searchParams.entries());
    req.body = await readBody(req);

    if (!handler) {
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        if (url.pathname === '/index.html') {
          const token = readSessionToken(req);
          const user = token ? await getUserByToken(token) : null;
          if (!user) {
            sendDelayedRedirectPage(res, '/auth.html', 'Authentication required', 1500);
            return;
          }
        }

        const staticPath = safeResolveStatic(url.pathname);
        if (staticPath && fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
          res.statusCode = 200;
          res.setHeader('Content-Type', contentTypeByExt(staticPath));
          res.end(fs.readFileSync(staticPath));
          return;
        }
      }

      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Route not found', path: url.pathname, method: req.method }));
      return;
    }

    await handler(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'Local server error',
        message: error?.message || 'unknown'
      })
    );
  }
});

server.listen(3000, () => {
  console.log('Local API server running at http://localhost:3000');
});
