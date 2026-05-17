const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./models/User');
const { signToken, verifyToken, requireRole } = require('./middleware/auth');

const PORT = process.env.PORT || 3004;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/adflow';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service', uptime: process.uptime() });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      name,
      role: role || 'operator',
    });
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/verify', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false });
  }
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'adflow-dev-secret-change-in-production');
    res.json({ valid: true, user: decoded });
  } catch {
    res.status(401).json({ valid: false });
  }
});

app.get('/api/auth/users', verifyToken, requireRole('admin'), async (req, res) => {
  const users = await User.find().select('-passwordHash').lean();
  res.json({ data: users });
});

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@adflow.local';
  const exists = await User.findOne({ email });
  if (!exists) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await User.create({ email, passwordHash, name: 'Admin', role: 'admin' });
    console.log(`Seeded admin user: ${email}`);
  }
}

async function start() {
  await mongoose.connect(MONGODB_URI);
  await seedAdmin();
  app.listen(PORT, () => console.log(`auth-service on :${PORT}`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { app, start };
