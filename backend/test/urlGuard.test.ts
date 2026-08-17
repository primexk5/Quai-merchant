import { describe, it, expect } from 'vitest';
import {
  isPrivateIp,
  assertSafeWebhookUrl,
  assertResolvesPublic,
  UnsafeWebhookUrlError,
} from '../src/webhooks/urlGuard.js';

describe('isPrivateIp', () => {
  it('flags IPv4 private/loopback/link-local/reserved ranges', () => {
    for (const ip of [
      '0.0.0.0',
      '10.1.2.3',
      '127.0.0.1',
      '100.64.0.1',
      '169.254.169.254', // cloud metadata
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '192.0.2.5',
      '198.18.0.1',
      '198.51.100.7',
      '203.0.113.9',
      '224.0.0.1',
      '255.255.255.255',
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('allows genuinely public IPv4 (incl. addresses just outside private ranges)', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '192.169.0.1', '100.63.255.255']) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it('flags IPv6 loopback/ULA/link-local/multicast and IPv4-mapped internals', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:169.254.169.254']) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('allows public IPv6 (incl. IPv4-mapped public)', () => {
    for (const ip of ['2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8']) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it('treats a non-IP string as unsafe (fail closed)', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true);
  });
});

describe('assertSafeWebhookUrl', () => {
  it('accepts a normal https URL', () => {
    expect(() => assertSafeWebhookUrl('https://merchant.example.com/hook', false)).not.toThrow();
  });

  it('rejects non-https when the guard is active', () => {
    expect(() => assertSafeWebhookUrl('http://merchant.example.com/hook', false)).toThrow(UnsafeWebhookUrlError);
  });

  it('rejects loopback/internal hostnames and private IP literals', () => {
    for (const url of [
      'https://localhost/hook',
      'https://foo.localhost/hook',
      'https://svc.local/hook',
      'https://svc.internal/hook',
      'https://127.0.0.1/hook',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/hook',
      'https://[fd00::1]/hook',
    ]) {
      expect(() => assertSafeWebhookUrl(url, false), url).toThrow(UnsafeWebhookUrlError);
    }
  });

  it('rejects a malformed URL', () => {
    expect(() => assertSafeWebhookUrl('not a url', false)).toThrow(UnsafeWebhookUrlError);
  });

  it('with allowInsecure only requires http(s) and skips the private-range checks', () => {
    expect(() => assertSafeWebhookUrl('http://localhost:9000/hook', true)).not.toThrow();
    expect(() => assertSafeWebhookUrl('ftp://localhost/hook', true)).toThrow(UnsafeWebhookUrlError);
  });
});

describe('assertResolvesPublic', () => {
  it('is a no-op when allowInsecure is true', async () => {
    await expect(assertResolvesPublic('127.0.0.1', true)).resolves.toBeUndefined();
  });

  it('rejects a private IP literal without needing DNS', async () => {
    await expect(assertResolvesPublic('127.0.0.1', false)).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
    await expect(assertResolvesPublic('169.254.169.254', false)).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });

  it('accepts a public IP literal without needing DNS', async () => {
    await expect(assertResolvesPublic('8.8.8.8', false)).resolves.toBeUndefined();
  });

  it('rejects a hostname that resolves to loopback (DNS-rebinding guard)', async () => {
    // `localhost` resolves to a loopback address on every platform without touching the network.
    await expect(assertResolvesPublic('localhost', false)).rejects.toBeInstanceOf(UnsafeWebhookUrlError);
  });
});
