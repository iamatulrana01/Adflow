const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { MetricsStore } = require('./metricsStore');
const { checkAllServices } = require('./healthChecker');

const PORT = process.env.PORT || 3002;
const CAMPAIGN_API_URL = process.env.CAMPAIGN_API_URL || 'http://localhost:3001';
const NOTIFICATION_URL = process.env.NOTIFICATION_URL || 'http://localhost:3005';

const store = new MetricsStore();
const clients = new Set();

async function sendNotification(alert) {
  try {
    await fetch(`${NOTIFICATION_URL}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `AdFlow Alert: ${alert.type}`,
        message: alert.message,
        severity: alert.severity,
        channels: ['slack', 'email'],
      }),
    });
  } catch {
    console.log('[alert]', alert.message);
  }
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

async function fetchCampaignStats() {
  const start = Date.now();
  try {
    const res = await fetch(`${CAMPAIGN_API_URL}/api/campaigns/stats`);
    store.recordRequest(Date.now() - start, !res.ok);
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    store.recordRequest(Date.now() - start, true);
    return null;
  }
}

async function publishMetrics() {
  const [externalStats, healthData] = await Promise.all([
    fetchCampaignStats(),
    checkAllServices(),
  ]);
  store.setHealthData(healthData);
  const snapshot = store.getSnapshot(externalStats);
  const triggered = store.checkThresholds(snapshot);

  if (triggered.length) {
    for (const alert of triggered) {
      const stored = store.addAlert(alert);
      await sendNotification(stored);
    }
  }

  broadcast({ type: 'metrics', data: snapshot });
  return snapshot;
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'monitoring-service', clients: clients.size });
});

app.get('/metrics', async (req, res) => {
  const snapshot = await publishMetrics();
  res.json(snapshot);
});

app.get('/health/services', async (req, res) => {
  const health = await checkAllServices();
  res.json(health);
});

app.post('/events', (req, res) => {
  const start = Date.now();
  const { event, payload } = req.body;
  store.recordEvent(event, payload);
  store.recordRequest(Date.now() - start);
  publishMetrics().catch(console.error);
  res.status(202).json({ received: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  clients.add(ws);
  publishMetrics().then((snapshot) => {
    ws.send(JSON.stringify({ type: 'metrics', data: snapshot }));
  });
  ws.on('close', () => clients.delete(ws));
});

setInterval(() => publishMetrics().catch(console.error), 5000);

server.listen(PORT, () => {
  console.log(`monitoring-service listening on :${PORT}`);
});

module.exports = { app, store, publishMetrics };
