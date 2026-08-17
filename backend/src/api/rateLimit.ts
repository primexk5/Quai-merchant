import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number; // unix ms; when this IP's window resets
}

/**
 * Minimal, dependency-free fixed-window rate limiter keyed by client IP. It exists to stop the one
 * unauthenticated, RPC-backed route (`GET /v1/orders/...`) from being used to hammer the upstream
 * Quai node — not as a general abuse shield.
 *
 * Single-process only: the counters live in memory, so behind multiple instances each replica
 * enforces its own limit. For a real multi-instance deployment, rate-limit at the proxy/CDN instead.
 * Note that `req.ip` is only trustworthy if Express `trust proxy` is configured to match your
 * infrastructure; without it, all requests behind a proxy share one bucket.
 */
export function rateLimit(opts: { windowMs: number; max: number }) {
  const buckets = new Map<string, Bucket>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    let b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, b);
    }
    b.count++;
    // Opportunistic sweep so the map can't grow without bound under a spray of distinct IPs.
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    if (b.count > opts.max) {
      res.setHeader('retry-after', Math.max(1, Math.ceil((b.resetAt - now) / 1000)));
      res.status(429).json({ error: 'too many requests' });
      return;
    }
    next();
  };
}
