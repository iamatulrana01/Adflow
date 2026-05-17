/**
 * In-process event queue for async campaign processing.
 * Production: replace with Redis/Bull or SQS.
 */
class EventQueue {
  constructor(processor, options = {}) {
    this.processor = processor;
    this.concurrency = options.concurrency || 5;
    this.queue = [];
    this.active = 0;
    this.stats = { processed: 0, failed: 0, queued: 0 };
  }

  enqueue(job) {
    this.stats.queued += 1;
    this.queue.push({ ...job, enqueuedAt: Date.now() });
    this._drain();
    return { jobId: job.id, position: this.queue.length };
  }

  _drain() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      this.active += 1;
      this.processor(job)
        .then(() => {
          this.stats.processed += 1;
        })
        .catch(() => {
          this.stats.failed += 1;
        })
        .finally(() => {
          this.active -= 1;
          this._drain();
        });
    }
  }

  getStats() {
    return {
      ...this.stats,
      pending: this.queue.length,
      active: this.active,
    };
  }
}

module.exports = { EventQueue };
