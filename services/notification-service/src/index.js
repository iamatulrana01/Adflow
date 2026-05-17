const express = require('express');
const cors = require('cors');
const { NotificationQueue } = require('./queue');

const PORT = process.env.PORT || 3005;
const queue = new NotificationQueue();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service', queue: queue.getStats() });
});

app.post('/api/notifications', (req, res) => {
  const { title, message, severity, channels, type } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'title and message are required' });
  }
  const item = queue.enqueue({
    title,
    message,
    severity: severity || 'info',
    channels: channels || ['slack', 'email'],
    type: type || 'alert',
  });
  res.status(202).json({ queued: true, notification: item });
});

app.get('/api/notifications/history', (req, res) => {
  res.json(queue.getStats());
});

app.listen(PORT, () => console.log(`notification-service on :${PORT}`));

module.exports = { app, queue };
