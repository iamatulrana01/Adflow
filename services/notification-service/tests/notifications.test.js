const request = require('supertest');
const { app } = require('../src/index');

describe('Notification Service', () => {
  test('health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('queues notification', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .send({ title: 'Test', message: 'Hello', severity: 'warning' });
    expect(res.status).toBe(202);
    expect(res.body.queued).toBe(true);
  });
});
