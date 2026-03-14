const nodemailer = require('nodemailer');

function getTransportConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();

  if (!host || !user || !pass) return null;

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  };
}

async function sendPasswordResetEmail({ to, resetLink }) {
  const config = getTransportConfig();
  if (!config) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const from = String(process.env.MAIL_FROM || process.env.SMTP_USER || '').trim();
  if (!from) {
    return { sent: false, reason: 'MAIL_FROM is not configured' };
  }

  const transporter = nodemailer.createTransport(config);
  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your Chrono password',
    text: `We received a password reset request. Open this link: ${resetLink}\nIf you did not request this, ignore this email.`,
    html: `<p>We received a password reset request.</p><p><a href="${resetLink}">Click here to reset your password</a></p><p>If you did not request this, ignore this email.</p>`
  });

  return { sent: true };
}

async function sendEmail({ to, subject, text, html }) {
  const config = getTransportConfig();
  if (!config) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const from = String(process.env.MAIL_FROM || process.env.SMTP_USER || '').trim();
  if (!from) {
    return { sent: false, reason: 'MAIL_FROM is not configured' };
  }

  const transporter = nodemailer.createTransport(config);
  await transporter.sendMail({
    from,
    to,
    subject: String(subject || 'Chrono notification'),
    text: String(text || ''),
    html: html || `<p>${String(text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
  });

  return { sent: true };
}

module.exports = {
  sendPasswordResetEmail,
  sendEmail
};
