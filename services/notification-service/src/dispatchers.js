const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO;

async function sendSlack({ title, message, severity }) {
  if (!SLACK_WEBHOOK) {
    console.log(`[slack:skipped] ${title}: ${message}`);
    return { channel: 'slack', sent: false, simulated: true };
  }
  const res = await fetch(SLACK_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `*[${severity || 'info'}] ${title}*\n${message}`,
    }),
  });
  return { channel: 'slack', sent: res.ok };
}

async function sendEmail({ title, message }) {
  if (!ALERT_EMAIL_TO) {
    console.log(`[email:skipped] ${title}: ${message}`);
    return { channel: 'email', sent: false, simulated: true };
  }
  console.log(`[email] To: ${ALERT_EMAIL_TO} | ${title}: ${message}`);
  return { channel: 'email', sent: true, simulated: true };
}

async function dispatchNotification(notification) {
  const { channels = ['slack', 'email'], title, message, severity } = notification;
  const payload = { title, message, severity };
  const tasks = [];
  if (channels.includes('slack')) tasks.push(sendSlack(payload));
  if (channels.includes('email')) tasks.push(sendEmail(payload));
  return Promise.all(tasks);
}

module.exports = { dispatchNotification, sendSlack, sendEmail };
