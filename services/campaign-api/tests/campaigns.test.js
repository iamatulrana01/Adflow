const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { createApp } = require('../src/app');
const Campaign = require('../src/models/Campaign');

jest.mock('../src/services/campaignService', () => {
  const actual = jest.requireActual('../src/services/campaignService');
  return {
    ...actual,
    classifyAndRoute: jest.fn(async (id) => {
      const CampaignModel = require('../src/models/Campaign');
      const doc = await CampaignModel.findById(id);
      doc.status = 'routed';
      doc.classification = {
        category: 'performance',
        priority: 'high',
        route: 'queue-performance',
        confidence: 0.92,
        reasoning: 'test',
        provider: 'mock',
        objective: 'conversion',
        target_platform: 'meta',
        approval_flow: 'auto',
        workflow_steps: ['bid-optimization', 'launch'],
      };
      await doc.save();
      return doc;
    }),
  };
});

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Campaign.deleteMany();
});

describe('Campaign API', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('POST /api/campaigns creates campaign', async () => {
    const res = await request(app)
      .post('/api/campaigns')
      .send({ name: 'Summer Sale', budget: 5000, channel: 'social' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Summer Sale');
    expect(res.body.status).toBe('pending');
  });

  test('POST /api/campaigns rejects missing fields', async () => {
    const res = await request(app).post('/api/campaigns').send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  test('GET /api/campaigns lists campaigns', async () => {
    await Campaign.create({ name: 'A', budget: 100 });
    await Campaign.create({ name: 'B', budget: 200 });
    const res = await request(app).get('/api/campaigns');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  test('GET /api/campaigns/stats returns aggregates', async () => {
    await Campaign.create({
      name: 'A',
      budget: 100,
      status: 'active',
      metrics: { impressions: 1000, clicks: 50, conversions: 5, spend: 80 },
    });
    const res = await request(app).get('/api/campaigns/stats');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.metrics.impressions).toBe(1000);
  });
});
