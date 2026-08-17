/**
 * Exponential backoff with full jitter, capped. Pure and deterministic given `rand`, so it's unit
 * testable. `attempt` is 1-based (the delay to wait *before* attempt N+1 after N failures).
 */
export function backoffMs(
  attempt: number,
  baseMs: number,
  maxMs: number,
  rand: () => number = Math.random,
): number {
  const exp = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
  // Full jitter: uniform in [0, exp]. Spreads retries so many failed deliveries don't stampede.
  return Math.floor(rand() * exp);
}
