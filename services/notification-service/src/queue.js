class NotificationQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.history = [];
    this.maxHistory = 200;
  }

  enqueue(notification) {
    const item = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...notification,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.queue.push(item);
    this.process().catch(console.error);
    return item;
  }

  async process() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      try {
        const { dispatchNotification } = require('./dispatchers');
        const results = await dispatchNotification(item);
        item.status = 'sent';
        item.deliveries = results;
      } catch (err) {
        item.status = 'failed';
        item.error = err.message;
      }
      this.history.unshift(item);
      if (this.history.length > this.maxHistory) this.history.pop();
    }
    this.processing = false;
  }

  getStats() {
    return {
      pending: this.queue.length,
      sent: this.history.filter((h) => h.status === 'sent').length,
      failed: this.history.filter((h) => h.status === 'failed').length,
      recent: this.history.slice(0, 20),
    };
  }
}

module.exports = { NotificationQueue };
