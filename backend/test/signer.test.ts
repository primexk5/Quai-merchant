import { describe, it, expect } from 'vitest';
import { signPayload, verifySignature } from '../src/webhooks/signer.js';

const SECRET = 'whsec_test_secret';
const BODY = JSON.stringify({ id: 'evt_1', type: 'payment.confirmed' });

describe('webhook signer', () => {
  it('verifies a signature it produced', () => {
    const now = 1_700_000_000;
    const header = signPayload(SECRET, BODY, now);
    expect(verifySignature(SECRET, header, BODY, now)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const now = 1_700_000_000;
    const header = signPayload(SECRET, BODY, now);
    expect(verifySignature(SECRET, header, BODY + 'x', now)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const now = 1_700_000_000;
    const header = signPayload(SECRET, BODY, now);
    expect(verifySignature('whsec_other', header, BODY, now)).toBe(false);
  });

  it('rejects a stale timestamp beyond tolerance', () => {
    const signedAt = 1_700_000_000;
    const header = signPayload(SECRET, BODY, signedAt);
    expect(verifySignature(SECRET, header, BODY, signedAt + 301, 300)).toBe(false);
    expect(verifySignature(SECRET, header, BODY, signedAt + 299, 300)).toBe(true);
  });

  it('rejects malformed or missing headers', () => {
    const now = 1_700_000_000;
    expect(verifySignature(SECRET, undefined, BODY, now)).toBe(false);
    expect(verifySignature(SECRET, 'garbage', BODY, now)).toBe(false);
    expect(verifySignature(SECRET, 't=abc,v1=zz', BODY, now)).toBe(false);
  });
});
