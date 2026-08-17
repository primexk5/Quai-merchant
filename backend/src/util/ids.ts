import { randomBytes } from 'node:crypto';

/** URL-safe base32-ish token from random bytes (no padding, lowercase). */
function token(bytes: number): string {
  return randomBytes(bytes).toString('base64url').replace(/[-_]/g, '').toLowerCase();
}

export function newMerchantId(): string {
  return `mch_${token(12)}`;
}

/** A webhook signing secret. Shown to the merchant once at onboarding; store it securely. */
export function newWebhookSecret(): string {
  return `whsec_${token(24)}`;
}
