const os = require('os');

const SERVICES = [
  { name: 'campaign-api', url: process.env.CAMPAIGN_API_URL || 'http://localhost:3001' },
  { name: 'ai-classifier', url: process.env.AI_CLASSIFIER_URL || 'http://localhost:8000' },
  { name: 'auth-service', url: process.env.AUTH_SERVICE_URL || 'http://localhost:3004' },
  { name: 'notification-service', url: process.env.NOTIFICATION_URL || 'http://localhost:3005' },
  { name: 'analytics-service', url: process.env.ANALYTICS_URL || 'http://localhost:3006' },
  { name: 'ingestion-worker', url: process.env.INGESTION_URL || 'http://localhost:3003' },
];

async function checkService(service) {
  const start = Date.now();
  try {
    const res = await fetch(`${service.url}/health`, { signal: AbortSignal.timeout(3000) });
    const latencyMs = Date.now() - start;
    const body = res.ok ? await res.json() : null;
    return {
      name: service.name,
      healthy: res.ok,
      latencyMs,
      status: res.ok ? 'up' : 'degraded',
      uptime: body?.uptime,
    };
  } catch (err) {
    return {
      name: service.name,
      healthy: false,
      latencyMs: Date.now() - start,
      status: 'down',
      error: err.message,
    };
  }
}

function getSystemMetrics() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  return {
    cpuCount: cpus.length,
    loadAvg: os.loadavg(),
    memory: {
      totalMb: Math.round(totalMem / 1024 / 1024),
      usedMb: Math.round(usedMem / 1024 / 1024),
      usedPercent: Math.round((usedMem / totalMem) * 100),
    },
    uptime: os.uptime(),
  };
}

async function checkAllServices() {
  const results = await Promise.all(SERVICES.map(checkService));
  const healthyCount = results.filter((r) => r.healthy).length;
  return {
    services: results,
    summary: {
      total: results.length,
      healthy: healthyCount,
      unhealthy: results.length - healthyCount,
      uptimePercent: Math.round((healthyCount / results.length) * 10000) / 100,
    },
    system: getSystemMetrics(),
    checkedAt: new Date().toISOString(),
  };
}

module.exports = { checkAllServices, getSystemMetrics, SERVICES };
