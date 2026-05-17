const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const campaignRoutes = require('./routes/campaigns');
const { aiClient } = require('./services/campaignService');
const { eventQueue } = require('./services/campaignService');
const { optionalAuth } = require('./middleware/optionalAuth');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'campaign-api',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      circuitBreakers: [aiClient.getStats()],
      queue: eventQueue.getStats(),
    });
  });

  app.use('/api', optionalAuth);
  app.use('/api/campaigns', campaignRoutes);

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
    });
  });

  return app;
}

module.exports = { createApp };
