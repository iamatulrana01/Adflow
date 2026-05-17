const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 3006;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/adflow';
const CAMPAIGN_API_URL = process.env.CAMPAIGN_API_URL || 'http://localhost:3001';

const campaignSchema = new mongoose.Schema({}, { strict: false, collection: 'campaigns' });
const Campaign = mongoose.model('Campaign', campaignSchema);

const app = express();
app.use(cors());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'analytics-service', uptime: process.uptime() });
});

app.get('/api/analytics/overview', async (req, res) => {
  try {
    const [byStatus, byCategory, byChannel, topCampaigns, dailyTrend] = await Promise.all([
      Campaign.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Campaign.aggregate([
        { $match: { 'classification.category': { $exists: true } } },
        { $group: { _id: '$classification.category', count: { $sum: 1 } } },
      ]),
      Campaign.aggregate([{ $group: { _id: '$channel', count: { $sum: 1 } } }]),
      Campaign.find()
        .sort({ 'metrics.conversions': -1 })
        .limit(10)
        .select('name status metrics classification.category')
        .lean(),
      Campaign.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            created: { $sum: 1 },
            spend: { $sum: '$metrics.spend' },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 14 },
      ]),
    ]);

    const totals = await Campaign.aggregate([
      {
        $group: {
          _id: null,
          campaigns: { $sum: 1 },
          impressions: { $sum: '$metrics.impressions' },
          clicks: { $sum: '$metrics.clicks' },
          conversions: { $sum: '$metrics.conversions' },
          spend: { $sum: '$metrics.spend' },
        },
      },
    ]);

    const t = totals[0] || { campaigns: 0, impressions: 0, clicks: 0, conversions: 0, spend: 0 };

    res.json({
      totals: t,
      ctr: t.impressions ? (t.clicks / t.impressions) * 100 : 0,
      conversionRate: t.clicks ? (t.conversions / t.clicks) * 100 : 0,
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
      byCategory: Object.fromEntries(byCategory.map((c) => [c._id, c.count])),
      byChannel: Object.fromEntries(byChannel.map((c) => [c._id, c.count])),
      topCampaigns,
      dailyTrend: dailyTrend.reverse(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/failures', async (req, res) => {
  const failed = await Campaign.find({ status: 'failed' })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
  res.json({ count: failed.length, data: failed });
});

app.get('/api/analytics/performance', async (req, res) => {
  const start = Date.now();
  try {
    const resApi = await fetch(`${CAMPAIGN_API_URL}/health`);
    const latencyMs = Date.now() - start;
    res.json({
      campaignApi: { healthy: resApi.ok, latencyMs },
      analyticsService: { uptime: process.uptime() },
    });
  } catch (err) {
    res.json({
      campaignApi: { healthy: false, error: err.message },
      analyticsService: { uptime: process.uptime() },
    });
  }
});

async function start() {
  await mongoose.connect(MONGODB_URI);
  app.listen(PORT, () => console.log(`analytics-service on :${PORT}`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { app, start };
