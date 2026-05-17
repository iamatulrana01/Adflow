/**
 * Simulates AWS Lambda campaign ingestion handler.
 * In production, deploy src/lambda/handler.js to Lambda with S3 event triggers.
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { validateBatch, sanitizeCampaign } = require('./validate');

const PORT = process.env.PORT || 3003;
const CAMPAIGN_API_URL = process.env.CAMPAIGN_API_URL || 'http://localhost:3001';
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';
const STORAGE_DIR = path.join(__dirname, '../storage');

if (USE_LOCAL_STORAGE && !fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

async function forwardToCampaignApi(campaigns) {
  const start = Date.now();
  const res = await fetch(`${CAMPAIGN_API_URL}/api/campaigns/ingest/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaigns }),
  });
  const body = await res.json();
  return { status: res.status, body, elapsedMs: Date.now() - start };
}

function persistPayload(key, payload) {
  if (!USE_LOCAL_STORAGE) return { stored: false, key };
  const filePath = path.join(STORAGE_DIR, `${key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return { stored: true, key, path: filePath };
}

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ingestion-worker' });
});

/** Lambda-style S3 event ingestion */
app.post('/ingest/s3-event', async (req, res) => {
  try {
    const records = req.body.Records || [];
    const campaigns = [];

    for (const record of records) {
      const key = record.s3?.object?.key || `manual-${uuidv4()}`;
      const inline = record.campaigns || record.body?.campaigns;
      if (inline) {
        persistPayload(key, inline);
        campaigns.push(...inline);
      }
    }

    if (!campaigns.length && req.body.campaigns) {
      campaigns.push(...req.body.campaigns);
    }

    if (!campaigns.length) {
      return res.status(400).json({ error: 'No campaigns in event payload' });
    }

    const errors = validateBatch(campaigns);
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });
    const sanitized = campaigns.map(sanitizeCampaign);

    const result = await forwardToCampaignApi(sanitized);
    res.status(result.status).json({
      ingestionId: uuidv4(),
      campaignsReceived: campaigns.length,
      ...result.body,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Direct high-volume ingestion endpoint */
app.post('/ingest/batch', async (req, res) => {
  try {
    const { campaigns } = req.body;
    const errors = validateBatch(campaigns);
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });
    const sanitized = campaigns.map(sanitizeCampaign);
    const key = `batch-${uuidv4()}`;
    persistPayload(key, sanitized);
    const result = await forwardToCampaignApi(sanitized);
    res.status(202).json({ ingestionId: key, ...result.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`ingestion-worker on :${PORT}`));
}

module.exports = app;
