const mongoose = require('mongoose');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/adflow';

async function start() {
  await mongoose.connect(MONGODB_URI);
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`campaign-api listening on :${PORT}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start campaign-api:', err);
    process.exit(1);
  });
}

module.exports = { start };
