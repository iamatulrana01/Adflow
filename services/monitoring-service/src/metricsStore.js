const THRESHOLDS = {
  errorRatePercent: 5,
  avgLatencyMs: 200,
  failedCampaigns: 10,
  memoryUsedPercent: 90,
  serviceDownCount: 1,
};

class MetricsStore {
  constructor() {
    this.reset();
    this.eventLog = [];
    this.maxLogSize = 500;
    this.serviceHealth = null;
    this.systemMetrics = null;
  }

  reset() {
    this.requests = 0;
    this.errors = 0;
    this.latencies = [];
    this.campaignEvents = { created: 0, routed: 0, active: 0, failed: 0 };
    this.alerts = [];
    this.lastHealthCheck = new Date().toISOString();
  }

  recordRequest(latencyMs, isError = false) {
    this.requests += 1;
    if (isError) this.errors += 1;
    this.latencies.push(latencyMs);
    if (this.latencies.length > 200) this.latencies.shift();
  }

  recordEvent(event, payload = {}) {
    const entry = { event, payload, timestamp: new Date().toISOString() };
    this.eventLog.unshift(entry);
    if (this.eventLog.length > this.maxLogSize) this.eventLog.pop();
    if (event.includes('failed')) this.campaignEvents.failed += 1;
    if (event.includes('created')) this.campaignEvents.created += 1;
    if (event.includes('routed')) this.campaignEvents.routed += 1;
    if (event.includes('active')) this.campaignEvents.active += 1;
  }

  setHealthData(healthData) {
    this.serviceHealth = healthData;
    this.systemMetrics = healthData.system;
    this.lastHealthCheck = healthData.checkedAt;
  }

  getSnapshot(externalStats = null) {
    const avgLatency =
      this.latencies.length === 0
        ? 0
        : this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
    const errorRate = this.requests ? (this.errors / this.requests) * 100 : 0;

    return {
      timestamp: new Date().toISOString(),
      system: {
        requests: this.requests,
        errors: this.errors,
        errorRatePercent: Math.round(errorRate * 100) / 100,
        avgLatencyMs: Math.round(avgLatency),
        uptime: process.uptime(),
        host: this.systemMetrics || null,
      },
      serviceHealth: this.serviceHealth,
      campaigns: this.campaignEvents,
      campaignKpis: externalStats || null,
      thresholds: THRESHOLDS,
      recentEvents: this.eventLog.slice(0, 20),
      alerts: this.alerts.slice(0, 10),
    };
  }

  checkThresholds(snapshot) {
    const triggered = [];
    const { system, campaigns, serviceHealth } = snapshot;

    if (system.errorRatePercent > THRESHOLDS.errorRatePercent) {
      triggered.push({
        type: 'error_rate',
        severity: 'critical',
        message: `Error rate ${system.errorRatePercent}% exceeds ${THRESHOLDS.errorRatePercent}%`,
      });
    }
    if (system.avgLatencyMs > THRESHOLDS.avgLatencyMs) {
      triggered.push({
        type: 'latency',
        severity: 'warning',
        message: `Avg API latency ${system.avgLatencyMs}ms exceeds ${THRESHOLDS.avgLatencyMs}ms`,
      });
    }
    if (campaigns.failed > THRESHOLDS.failedCampaigns) {
      triggered.push({
        type: 'failed_campaigns',
        severity: 'critical',
        message: `Failed campaigns (${campaigns.failed}) exceed threshold`,
      });
    }
    if (system.host?.memory?.usedPercent > THRESHOLDS.memoryUsedPercent) {
      triggered.push({
        type: 'memory',
        severity: 'warning',
        message: `Memory usage ${system.host.memory.usedPercent}% exceeds ${THRESHOLDS.memoryUsedPercent}%`,
      });
    }
    if (serviceHealth?.summary?.unhealthy >= THRESHOLDS.serviceDownCount) {
      triggered.push({
        type: 'service_down',
        severity: 'critical',
        message: `${serviceHealth.summary.unhealthy} service(s) are down`,
      });
    }
    return triggered;
  }

  addAlert(alert) {
    const entry = { ...alert, id: `alert-${Date.now()}`, timestamp: new Date().toISOString() };
    this.alerts.unshift(entry);
    if (this.alerts.length > 50) this.alerts.pop();
    return entry;
  }
}

module.exports = { MetricsStore, THRESHOLDS };
