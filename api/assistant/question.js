const { send } = require('../_lib/http');
const { requireAuthenticatedUser } = require('../_lib/auth-guard');
const { getDueAssistantQuestion } = require('../_lib/assistant-store');
const { hasMuleSoftConfig } = require('../_lib/mulesoft-client');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const authUser = await requireAuthenticatedUser(req, res, send);
  if (!authUser) return;

  const due = await getDueAssistantQuestion(authUser.userId, new Date());
  if (!due) {
    return send(res, 200, {
      success: true,
      due: false,
      message: 'No pending assistant question right now.'
    });
  }

  return send(res, 200, {
    success: true,
    due: true,
    slotKey: due.slotKey,
    scheduledHour: due.scheduledHour,
    question: due.question,
    notification: {
      title: 'Quick check-in 💛',
      body: due.question.text,
      transport: hasMuleSoftConfig() ? 'mulesoft-fcm' : 'local-web-notification'
    }
  });
};
