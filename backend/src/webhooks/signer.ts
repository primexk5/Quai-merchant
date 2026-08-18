import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Stripe-style webhook signatures. The signed message is `${timestamp}.${rawBody}`, HMAC-SHA256'd
 * with the merchant's per-merchant secret. The timestamp binds the signature to a moment in time so
 * a captured request can't be replayed indefinitely.
 *
 * Header format:  X-PayWithQuai-Signature: t=<unixSeconds>,v1=<hexHmac>
 */
export const SIGNATURE_HEADER = 'x-paywithquai-signature';

export function signPayload(secret: string, rawBody: string, timestampSec: number): string {
  const mac = createHmac('sha256', secret).update(`${timestampSec}.${rawBody}`).digest('hex');
  return `t=${timestampSec},v1=${mac}`;
}

function parseHeader(header: string): { t: number; v1: string } | undefined {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const idx = kv.indexOf('=');
      return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    }),
  ) as Record<string, string>;
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return undefined;
  return { t, v1: parts.v1 };
}

/**
 * Verify a received signature header against the raw body. Returns false on any malformed input,
 * signature mismatch, or when the timestamp is outside `toleranceSec` of `nowSec`.
 * Comparison is constant-time.
 */
export function verifySignature(
  secret: string,
  header: string | undefined,
  rawBody: string,
  nowSec: number,
  toleranceSec = 300,
): boolean {
  if (!header) return false;
  const parsed = parseHeader(header);
  if (!parsed) return false;
  if (Math.abs(nowSec - parsed.t) > toleranceSec) return false;

  const expected = createHmac('sha256', secret).update(`${parsed.t}.${rawBody}`).digest();
  if (!/^[0-9a-fA-F]{64}$/.test(parsed.v1)) return false; // exact 32-byte hex, else non-constant-time path
  const received = Buffer.from(parsed.v1, 'hex');
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
