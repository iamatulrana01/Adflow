const { MetricsStore } = require('../src/metricsStore');

describe('MetricsStore', () => {
  let store;

  beforeEach(() => {
    store = new MetricsStore();
  });

  test('tracks requests and errors', () => {
    store.recordRequest(100, false);
    store.recordRequest(200, true);
    const snap = store.getSnapshot();
    expect(snap.system.requests).toBe(2);
    expect(snap.system.errors).toBe(1);
    expect(snap.system.errorRatePercent).toBe(50);
  });

  test('triggers alerts on threshold breach', () => {
    for (let i = 0; i < 10; i++) store.recordRequest(100, true);
    const snap = store.getSnapshot();
    const alerts = store.checkThresholds(snap);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe('error_rate');
  });

  test('records campaign events', () => {
    store.recordEvent('campaign.created', { id: '1' });
    store.recordEvent('campaign.routed', { id: '1' });
    const snap = store.getSnapshot();
    expect(snap.campaigns.created).toBe(1);
    expect(snap.campaigns.routed).toBe(1);
  });
});
