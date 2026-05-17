const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO;

async function sendSlackAlert(alert) {
  if (!SLACK_WEBHOOK) {
    console.log('[alert:slack:skipped]', alert.message);
    return { sent: false, channel: 'slack' };
  }
  try {
    const res = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 *AdFlow Alert* [${alert.severity}]\n${alert.message}`,
      }),
    });
    return { sent: res.ok, channel: 'slack' };
  } catch (err) {
    console.error('Slack alert failed:', err.message);
    return { sent: false, channel: 'slack', error: err.message };
  }
}

async function sendEmailAlert(alert) {
  if (!ALERT_EMAIL_TO) {
    console.log('[alert:email:skipped]', alert.message);
    return { sent: false, channel: 'email' };
  }
  // Production: integrate SES/SendGrid. Log for local dev.
  console.log(`[alert:email] To: ${ALERT_EMAIL_TO} — ${alert.message}`);
  return { sent: true, channel: 'email', simulated: true };
}

async function dispatchAlerts(alerts) {
  const results = [];
  for (const alert of alerts) {
    const [slack, email] = await Promise.all([
      sendSlackAlert(alert),
      sendEmailAlert(alert),
    ]);
    results.push({ alert, deliveries: [slack, email] });
  }
  return results;
}

module.exports = { dispatchAlerts, sendSlackAlert, sendEmailAlert };
