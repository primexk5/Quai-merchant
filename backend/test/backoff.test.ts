import { describe, it, expect } from 'vitest';
import { backoffMs } from '../src/webhooks/backoff.js';

describe('backoff', () => {
  const BASE = 5000;
  const MAX = 3_600_000;

  it('never exceeds the exponential ceiling for the attempt', () => {
    for (let attempt = 1; attempt <= 12; attempt++) {
      const ceiling = Math.min(MAX, BASE * 2 ** (attempt - 1));
      // rand()=1 yields the max jitter for the attempt.
      expect(backoffMs(attempt, BASE, MAX, () => 0.999999)).toBeLessThanOrEqual(ceiling);
      expect(backoffMs(attempt, BASE, MAX, () => 0)).toBe(0);
    }
  });

  it('is capped at maxMs regardless of attempt', () => {
    expect(backoffMs(50, BASE, MAX, () => 1)).toBeLessThanOrEqual(MAX);
  });

  it('grows with attempt number (median jitter)', () => {
    const a = backoffMs(2, BASE, MAX, () => 0.5);
    const b = backoffMs(5, BASE, MAX, () => 0.5);
    expect(b).toBeGreaterThan(a);
  });
});
