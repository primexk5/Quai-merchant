import { describe, it, expect } from 'vitest';
import type { LookupAddress } from 'node:dns';
import { guardedLookup, postWebhook } from '../src/webhooks/httpPost.js';
import { UnsafeWebhookUrlError } from '../src/webhooks/urlGuard.js';

/** Deterministic fake resolver — never touches the network. */
function fakeResolve(addresses: LookupAddress[]) {
  return (
    _hostname: string,
    _options: import('node:dns').LookupAllOptions,
    callback: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
  ) => callback(null, addresses);
}

function callLookup(
  lookup: ReturnType<typeof guardedLookup>,
  options: { all?: boolean } = {},
): Promise<[NodeJS.ErrnoException | null, string | LookupAddress[], number]> {
  return new Promise((resolve) => {
    lookup(
      'hook.example.com',
      options as never,
      (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) =>
        resolve([err, address as LookupAddress[], family ?? 0]),
    );
  });
}

describe('guardedLookup', () => {
  it('returns a single validated address when options.all is not set', async () => {
    const lookup = guardedLookup(fakeResolve([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]));
    const [err, address, family] = await callLookup(lookup);
    expect(err).toBeNull();
    expect(address).toBe('93.184.216.34');
    expect(family).toBe(4);
  });

  it('returns the FULL validated address list when options.all is set (autoSelectFamily)', async () => {
    // Regression: returning a single string here makes Node iterate it character-by-character
    // and fail with "Invalid IP address: undefined" — every webhook delivery broke.
    const lookup = guardedLookup(fakeResolve([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      { address: '::ffff:127.0.0.1', family: 6 }, // private — must be filtered out
      { address: '10.0.0.1', family: 4 }, // private — must be filtered out
    ]));
    const [err, addresses] = await callLookup(lookup, { all: true });
    expect(err).toBeNull();
    expect(addresses).toEqual([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]);
  });

  it('rejects when every answer is private/reserved', async () => {
    const lookup = guardedLookup(fakeResolve([
      { address: '127.0.0.1', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]));
    const [err] = await callLookup(lookup, { all: true });
    expect(err).toBeInstanceOf(UnsafeWebhookUrlError);
    expect((err as Error).message).toMatch(/only to private\/reserved/);
  });

  it('propagates a resolver failure', async () => {
    const lookup = guardedLookup((_h, _o, cb) =>
      cb(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }) as never, [] as never),
    );
    const [err] = await callLookup(lookup);
    expect((err as Error).message).toBe('ENOTFOUND');
  });
});

describe('postWebhook end-to-end (guarded transport)', () => {
  it('delivers over the internet when the host resolves publicly', async () => {
    // Real public hostname through the guarded lookup + TLS — the exact path that failed with
    // "Invalid IP address: undefined" under Node's default autoSelectFamily (Happy Eyeballs).
    const res = await postWebhook({
      url: 'https://quai-merchant-three.vercel.app/api/nonexistent',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      timeoutMs: 10_000,
      allowInsecure: false,
    });
    // The point is the request reached the host with a real HTTP response (previously the socket
    // layer died before any connection with the IP validation error).
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(500);
    expect(res.error).toBeNull();
  }, 20_000);
});