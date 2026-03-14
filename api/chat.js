const { parseBody, send } = require('./_lib/http');
const { requireAuthenticatedUser } = require('./_lib/auth-guard');
const { getDueAssistantQuestion, addActivityLog } = require('./_lib/assistant-store');
const {
  getEventsByUser,
  getRecentChats,
  saveChat,
  buildSuggestion,
  nowIso
} = require('./_lib/store');

function rankTop(items, key, fallback = 'unknown') {
  const map = new Map();
  for (const item of items || []) {
    const value = String(item?.[key] || fallback);
    map.set(value, (map.get(value) || 0) + 1);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  return {
    value: sorted[0]?.[0] || fallback,
    count: sorted[0]?.[1] || 0,
    total: items?.length || 0
  };
}

function detectTone(message) {
  const m = String(message || '').toLowerCase();
  if (/late|missed|running\s+behind/.test(m)) return 'late';
  if (/tired|exhausted|drained|sleepy/.test(m)) return 'tired';
  if (/stress|anxious|overwhelm|panic/.test(m)) return 'stressed';
  if (/motivat|lazy|unfocus|procrastinat/.test(m)) return 'motivation';
  if (/where|go/.test(m)) return 'where';
  return 'neutral';
}

function buildLocalCoaching(message, suggestion, events, currentLocation) {
  const tone = detectTone(message);
  const byAction = rankTop(events, 'action', 'check plan');
  const byDestination = rankTop(events, 'destination', currentLocation || 'unknown');
  const confidence = byAction.total > 0 ? Math.round((byAction.count / byAction.total) * 100) : 0;

  let opener = 'You are doing well. Let us take one small step.';
  if (tone === 'late') opener = 'It is okay to be late sometimes. Let us recover calmly.';
  if (tone === 'tired') opener = 'Thanks for sharing. We can keep this very light right now.';
  if (tone === 'stressed') opener = 'Take one deep breath. We can simplify this moment together.';
  if (tone === 'motivation') opener = 'Tiny progress still counts. Let us pick the easiest next action.';

  const destinationLine =
    suggestion.suggestedDestination !== 'unknown' && suggestion.suggestedDestination !== currentLocation
      ? `Your likely destination is ${suggestion.suggestedDestination}.`
      : 'Stay where you are and begin with one small prep step.';

  const plan = [
    `1) Next best action: ${suggestion.suggestedAction}.`,
    `2) ${destinationLine}`,
    '3) Set a 10-minute check-in and I will adapt from your next update.'
  ].join(' ');

  return {
    reply: `${opener} ${plan}`,
    confidence,
    quickOptions: [
      { label: 'Start 10-min focus', value: 'focus_10' },
      { label: 'Remind me in 15 min', value: 'remind_15' },
      { label: 'Give gentler plan', value: 'gentle_plan' },
      { label: `Navigate to ${suggestion.suggestedDestination}`, value: 'navigate' }
    ],
    followUpQuestion: 'Which option should I do for you now?'
  };
}

async function groqReply(userMessage, suggestion, chats) {
  const enabled = String(process.env.AI_ENABLED || 'false') === 'true';
  const key = process.env.GROQ_API_KEY || '';
  if (!enabled || !key) return null;

  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  const url = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';

  const recent = (chats || []).slice(-8).map((c) => ({
    role: c.role === 'assistant' ? 'assistant' : 'user',
    content: c.message
  }));

  const body = {
    model,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content:
          'You are an emotionally intelligent smartwatch assistant. Respond in 3-5 short sentences. Be warm, practical, and specific. Include one actionable next step and one fallback option.'
      },
      {
        role: 'system',
        content: `Behavior profile: preferred_action=${suggestion.suggestedAction}, likely_destination=${suggestion.suggestedDestination}, events_seen=${suggestion.learnedFromEvents}`
      },
      ...recent,
      { role: 'user', content: userMessage }
    ]
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const body = parseBody(req);
  const uid = authUser.userId;
  const message = String(body.message || '');
  const timestamp = String(body.timestamp || nowIso());
  const currentLocation = String(body.currentLocation || 'unknown');

  const [events, chats] = await Promise.all([getEventsByUser(uid, 500), getRecentChats(uid, 10)]);
  const suggestion = buildSuggestion(events, timestamp, currentLocation);
  const local = buildLocalCoaching(message, suggestion, events, currentLocation);
  const checkIn = await getDueAssistantQuestion(uid, new Date());

  await saveChat(uid, 'user', message);
  await addActivityLog({ userId: uid, type: 'chat.user', detail: { messageLength: message.length } });

  let reply = local.reply;
  try {
    const fromGroq = await groqReply(message, suggestion, chats);
    if (fromGroq) reply = fromGroq;
  } catch {
    // fallback only
  }

  await saveChat(uid, 'assistant', reply);
  await addActivityLog({ userId: uid, type: 'chat.assistant', detail: { aiMode: String(process.env.AI_ENABLED || 'false') === 'true' && process.env.GROQ_API_KEY ? 'groq' : 'local-fallback' } });

  return send(res, 200, {
    userId: uid,
    reply,
    reminder: {
      suggestedAction: suggestion.suggestedAction,
      suggestedDestination: suggestion.suggestedDestination,
      basedOnEvents: suggestion.learnedFromEvents,
      confidence: local.confidence
    },
    question: local.followUpQuestion,
    options: local.quickOptions,
    friendlyCheckIn: checkIn
      ? {
          slotKey: checkIn.slotKey,
          questionId: checkIn.question.id,
          questionText: checkIn.question.text,
          options: checkIn.question.options
        }
      : null,
    aiMode:
      String(process.env.AI_ENABLED || 'false') === 'true' && process.env.GROQ_API_KEY
        ? 'groq'
        : 'local-fallback'
  });
};
