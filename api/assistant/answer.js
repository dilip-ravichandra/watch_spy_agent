const { parseBody, send } = require('../_lib/http');
const { requireAuthenticatedUser } = require('../_lib/auth-guard');
const { saveAssistantAnswer } = require('../_lib/assistant-store');
const { isNonEmptyString, asTrimmed } = require('../_lib/validate');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const body = parseBody(req);
  const slotKey = asTrimmed(body.slotKey);
  const questionId = asTrimmed(body.questionId);
  const questionText = asTrimmed(body.questionText);
  const answer = asTrimmed(body.answer);
  const selectedOption = asTrimmed(body.selectedOption);

  if (!isNonEmptyString(slotKey, 64)) return send(res, 400, { error: 'slotKey is required' });
  if (!isNonEmptyString(questionId, 64)) return send(res, 400, { error: 'questionId is required' });
  if (!isNonEmptyString(questionText, 300)) return send(res, 400, { error: 'questionText is required' });
  if (!isNonEmptyString(answer, 500)) return send(res, 400, { error: 'answer is required' });

  const saved = await saveAssistantAnswer({
    userId: authUser.userId,
    slotKey,
    questionId,
    questionText,
    answer,
    selectedOption,
    context: {
      source: 'chatbot-checkin',
      userAgent: String(req.headers['user-agent'] || '')
    }
  });

  if (!saved.ok) return send(res, 500, { error: saved.error || 'Could not save answer' });

  return send(res, 200, {
    success: true,
    message: 'Thank you. I saved your response and will learn from it kindly.'
  });
};
