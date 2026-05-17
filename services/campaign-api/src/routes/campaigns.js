const express = require('express');
const campaignService = require('../services/campaignService');
const { validateCampaignMiddleware, validateBulkMiddleware } = require('../middleware/validate');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { status, limit, skip, failed } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (failed === 'true') filter.status = 'failed';
    const campaigns = await campaignService.listCampaigns(filter, {
      limit: parseInt(limit, 10) || 50,
      skip: parseInt(skip, 10) || 0,
    });
    res.json({ data: campaigns, count: campaigns.length });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await campaignService.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/queue/stats', (req, res) => {
  res.json(campaignService.eventQueue.getStats());
});

router.get('/:id', async (req, res, next) => {
  try {
    const campaign = await campaignService.getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

router.post('/', validateCampaignMiddleware, async (req, res, next) => {
  try {
    const { name, description, budget, channel, metadata, objective, target_platform } = req.body;
    const campaign = await campaignService.createCampaign({
      name,
      description,
      budget,
      channel,
      metadata,
      objective,
      target_platform,
    });
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/process', async (req, res, next) => {
  try {
    const asyncMode = req.query.async === 'true';
    if (asyncMode) {
      const job = campaignService.queueProcess(req.params.id);
      return res.status(202).json({ queued: true, ...job });
    }
    const campaign = await campaignService.processCampaign(req.params.id);
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/classify', async (req, res, next) => {
  try {
    const campaign = await campaignService.classifyAndRoute(req.params.id);
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/metrics', async (req, res, next) => {
  try {
    const campaign = await campaignService.updateMetrics(req.params.id, req.body);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

router.post('/ingest/bulk', validateBulkMiddleware, async (req, res, next) => {
  try {
    const start = Date.now();
    const results = await campaignService.bulkIngest(req.body.campaigns);
    const elapsed = Date.now() - start;
    res.status(202).json({
      results,
      processed: results.length,
      elapsedMs: elapsed,
      throughputPerSec: Math.round((results.length / elapsed) * 1000 * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/ingest/async', validateBulkMiddleware, (req, res) => {
  const job = campaignService.queueBulkIngest(req.body.campaigns);
  res.status(202).json({ queued: true, campaigns: req.body.campaigns.length, ...job });
});

module.exports = router;
