const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app, start } = require('../src/index');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Auth Service', () => {
  test('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('register and login flow', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@adflow.io', password: 'secret123', name: 'Tester' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeDefined();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@adflow.io', password: 'secret123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });
});
