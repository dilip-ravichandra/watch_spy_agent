const { sql, ensureSchema } = require('./_lib/db');
const { json, parseBody, userIdFrom, buildSuggestion, nowIso } = require('./_lib/utils');

async function generateAiReply({ userMessage, suggestion, history }) {
  const aiEnabled = String(process.env.AI_ENABLED || 'false') === 'true';
  const key = process.env.GROQ_API_KEY || '';
  if (!aiEnabled || !key) return null;

  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  const url = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions';

  const recent = (history || []).slice(-10).map((h) => ({
    role: h.message_role === 'assistant' ? 'assistant' : 'user',
    content: h.message_text
  }));

  const body = {
    model,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content:
          'You are a kind smartwatch habit assistant. Be warm, brief, practical, and supportive.'
      },
      {
        role: 'system',
        content: `Learned habit now: action=${suggestion.suggestedAction}, destination=${suggestion.suggestedDestination}, basedOnEvents=${suggestion.learnedFromEvents}`
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
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  await ensureSchema();

  const body = parseBody(req);
  const userId = userIdFrom(req, body);
  const userMessage = String(body.message || '');
  const timestamp = String(body.timestamp || nowIso());
  const currentLocation = String(body.currentLocation || 'unknown');

  const [events, chats] = await Promise.all([
    sql`
      SELECT timestamp_iso, location, destination, action, source
      FROM habit_events
      WHERE user_id = ${userId}
      ORDER BY id DESC
      LIMIT 500
    `,
    sql`
      SELECT message_role, message_text, created_at
      FROM chat_history
      WHERE user_id = ${userId}
      ORDER BY id DESC
      LIMIT 10
    `
  ]);

  const suggestion = buildSuggestion(events.rows, timestamp, currentLocation);

  const lowered = userMessage.toLowerCase();
  let localReply = 'I am here for you, and I will keep learning what helps most.';
  if (lowered.includes('late')) localReply = 'That is okay. Let us focus on the next best step together.';
  else if (lowered.includes('tired')) localReply = 'You are doing your best. I can keep this gentle for you.';
  else if (lowered.includes('where')) localReply = 'I can help with that kindly.';
  else if (lowered.includes('what should i do')) localReply = 'I have a small suggestion for this hour.';

  localReply += ` You usually ${suggestion.suggestedAction} around this time.`;
  if (suggestion.suggestedDestination !== 'unknown' && suggestion.suggestedDestination !== currentLocation) {
    localReply += ` Around this time you often go to ${suggestion.suggestedDestination}.`;
  }

  await sql`
    INSERT INTO chat_history (user_id, message_role, message_text, created_at)
    VALUES (${userId}, 'user', ${userMessage}, ${nowIso()})
  `;

  let reply = localReply;
  try {
    const aiReply = await generateAiReply({
      userMessage,
      suggestion,
      history: chats.rows
    });
    if (aiReply) reply = aiReply;
  } catch {
    // fall back silently
  }

  await sql`
    INSERT INTO chat_history (user_id, message_role, message_text, created_at)
    VALUES (${userId}, 'assistant', ${reply}, ${nowIso()})
  `;

  return json(res, 200, {
    userId,
    reply,
    reminder: {
      suggestedAction: suggestion.suggestedAction,
      suggestedDestination: suggestion.suggestedDestination,
      basedOnEvents: suggestion.learnedFromEvents
    },
    question: 'Which option feels best right now?',
    options: [
      { label: 'Remind me now', value: 'remind_now' },
      { label: 'Ask me again later', value: 'ask_later' },
      { label: 'Show my usual destination', value: 'show_destination' },
      { label: 'I want a quieter suggestion', value: 'gentle_mode' }
    ],
    aiMode:
      String(process.env.AI_ENABLED || 'false') === 'true' && process.env.GROQ_API_KEY
        ? 'groq'
        : 'local-fallback'
  });
};
