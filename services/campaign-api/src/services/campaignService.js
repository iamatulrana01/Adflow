const Campaign = require('../models/Campaign');
const { createResilientClient } = require('../utils/httpClient');
const { EventQueue } = require('../queue/eventQueue');

const aiClient = createResilientClient('ai-classifier');
const monitoringClient = createResilientClient('monitoring');
const notificationClient = createResilientClient('notification');

const AI_CLASSIFIER_URL = process.env.AI_CLASSIFIER_URL || 'http://localhost:8000';
const MONITORING_URL = process.env.MONITORING_URL || 'http://localhost:3002';
const NOTIFICATION_URL = process.env.NOTIFICATION_URL || 'http://localhost:3005';
const BULK_CONCURRENCY = parseInt(process.env.BULK_CONCURRENCY, 10) || 10;

async function notifyMonitoring(event, payload) {
  try {
    await monitoringClient.request(`${MONITORING_URL}/events`, {
      method: 'POST',
      body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
    });
  } catch {
    /* non-blocking */
  }
}

async function notifyFailure(campaign, error) {
  try {
    await notificationClient.request(`${NOTIFICATION_URL}/api/notifications`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'Campaign Processing Failed',
        message: `Campaign "${campaign.name}" (${campaign._id}) failed: ${error}`,
        severity: 'critical',
        type: 'campaign_failure',
      }),
    });
  } catch {
    /* non-blocking */
  }
  await notifyMonitoring('campaign.failed', { id: campaign._id, error });
}

async function createCampaign(data) {
  const campaign = await Campaign.create({ ...data, status: 'pending' });
  await notifyMonitoring('campaign.created', { id: campaign._id, name: campaign.name });
  return campaign;
}

async function classifyAndRoute(campaignId) {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  campaign.status = 'classifying';
  await campaign.save();
  await notifyMonitoring('campaign.classifying', { id: campaignId });

  const classification = await aiClient.request(`${AI_CLASSIFIER_URL}/classify`, {
    method: 'POST',
    body: JSON.stringify({
      name: campaign.name,
      description: campaign.description,
      budget: campaign.budget,
      channel: campaign.channel,
      objective: campaign.metadata?.objective,
      target_platform: campaign.metadata?.target_platform,
    }),
  });

  campaign.classification = classification;
  campaign.status = 'routed';
  campaign.metadata = {
    ...campaign.metadata,
    routeQueue: classification.route,
    approvalFlow: classification.approval_flow,
    workflowSteps: classification.workflow_steps,
  };
  await campaign.save();

  await notifyMonitoring('campaign.routed', {
    id: campaignId,
    route: classification.route,
    priority: classification.priority,
    approval_flow: classification.approval_flow,
  });

  return campaign;
}

async function processCampaign(campaignId) {
  const campaign = await classifyAndRoute(campaignId);
  campaign.status = 'active';
  await campaign.save();
  await notifyMonitoring('campaign.active', { id: campaignId });
  return campaign;
}

async function processOneIngest(data) {
  const created = await createCampaign(data);
  try {
    const processed = await processCampaign(created._id);
    return { id: processed._id, status: 'success', route: processed.classification?.route };
  } catch (err) {
    await Campaign.findByIdAndUpdate(created._id, { status: 'failed' });
    await notifyFailure(created, err.message);
    return { id: created._id, status: 'failed', error: err.message };
  }
}

async function bulkIngest(campaigns) {
  const results = [];
  for (let i = 0; i < campaigns.length; i += BULK_CONCURRENCY) {
    const batch = campaigns.slice(i, i + BULK_CONCURRENCY);
    const batchResults = await Promise.all(batch.map(processOneIngest));
    results.push(...batchResults);
  }
  return results;
}

const eventQueue = new EventQueue(async (job) => {
  if (job.type === 'process') {
    await processCampaign(job.campaignId);
  } else if (job.type === 'bulk') {
    await bulkIngest(job.campaigns);
  }
});

function queueProcess(campaignId) {
  return eventQueue.enqueue({ id: `process-${campaignId}`, type: 'process', campaignId });
}

function queueBulkIngest(campaigns) {
  return eventQueue.enqueue({ id: `bulk-${Date.now()}`, type: 'bulk', campaigns });
}

async function listCampaigns(filter = {}, options = {}) {
  const { limit = 50, skip = 0, sort = '-createdAt' } = options;
  return Campaign.find(filter).sort(sort).skip(skip).limit(limit).lean();
}

async function getCampaign(id) {
  return Campaign.findById(id).lean();
}

async function updateMetrics(id, metrics) {
  const campaign = await Campaign.findByIdAndUpdate(id, { $set: { metrics } }, { new: true });
  if (campaign) await notifyMonitoring('campaign.metrics_updated', { id, metrics });
  return campaign;
}

async function getStats() {
  const [total, byStatus, aggregates, failed] = await Promise.all([
    Campaign.countDocuments(),
    Campaign.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Campaign.aggregate([
      {
        $group: {
          _id: null,
          impressions: { $sum: '$metrics.impressions' },
          clicks: { $sum: '$metrics.clicks' },
          conversions: { $sum: '$metrics.conversions' },
          spend: { $sum: '$metrics.spend' },
        },
      },
    ]),
    Campaign.countDocuments({ status: 'failed' }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
  const agg = aggregates[0] || { impressions: 0, clicks: 0, conversions: 0, spend: 0 };

  return {
    total,
    failed,
    byStatus: statusMap,
    metrics: agg,
    ctr: agg.impressions ? (agg.clicks / agg.impressions) * 100 : 0,
    conversionRate: agg.clicks ? (agg.conversions / agg.clicks) * 100 : 0,
  };
}

module.exports = {
  createCampaign,
  classifyAndRoute,
  processCampaign,
  listCampaigns,
  getCampaign,
  updateMetrics,
  getStats,
  bulkIngest,
  queueProcess,
  queueBulkIngest,
  eventQueue,
  aiClient,
  monitoringClient,
};
