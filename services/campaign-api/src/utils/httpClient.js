const CircuitBreaker = require('opossum');
const { retryWithBackoff } = require('./retry');

function createResilientClient(name, defaultOptions = {}) {
  const breaker = new CircuitBreaker(
    async (url, options = {}) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeout ?? 5000);
      try {
        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`${name} HTTP ${res.status}: ${body}`);
        }
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return res.json();
        }
        return res.text();
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      timeout: defaultOptions.timeout ?? 8000,
      errorThresholdPercentage: 50,
      resetTimeout: 15000,
      volumeThreshold: 5,
      name,
    }
  );

  breaker.fallback(() => {
    throw new Error(`${name} circuit open — service unavailable`);
  });

  return {
    async request(url, options = {}) {
      return retryWithBackoff(() => breaker.fire(url, options), {
        maxAttempts: options.retries ?? 3,
      });
    },
    getStats: () => ({
      name,
      state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
      stats: breaker.stats,
    }),
  };
}

module.exports = { createResilientClient };
