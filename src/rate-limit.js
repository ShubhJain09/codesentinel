/**
 * In-memory sliding-window rate limiter for sensitive endpoints.
 * Defends against brute-force password guessing, webhook floods, and API exhaustion.
 */

export function createRateLimiter({ windowMs = 60_000, max = 30 } = {}) {
  const hits = new Map(); // key -> Array<timestamp>

  function prune(now) {
    const threshold = now - windowMs;
    for (const [key, timestamps] of hits.entries()) {
      const active = timestamps.filter(t => t > threshold);
      if (active.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, active);
      }
    }
  }

  // Periodic cleanup every 2 minutes
  const timer = setInterval(() => prune(Date.now()), Math.max(windowMs, 30_000));
  if (timer.unref) timer.unref();

  return {
    check(key) {
      const now = Date.now();
      const threshold = now - windowMs;
      const history = (hits.get(key) || []).filter(t => t > threshold);

      if (history.length >= max) {
        const oldest = history[0];
        const retryAfterMs = Math.max(0, oldest + windowMs - now);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        };
      }

      history.push(now);
      hits.set(key, history);
      return {
        allowed: true,
        remaining: max - history.length,
        retryAfterSeconds: 0,
      };
    },
    reset(key) {
      if (key) hits.delete(key);
      else hits.clear();
    },
    destroy() {
      clearInterval(timer);
    },
  };
}
