import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { isIP, type LookupFunction } from 'node:net';
import { isPrivateIp, UnsafeWebhookUrlError } from './urlGuard.js';

/**
 * Outbound webhook POST with an SSRF-safe, atomic resolve-and-connect.
 *
 * The classic DNS-rebinding race is: resolve the host, verify every answer is public, then let the
 * fetch() implementation re-resolve the same name independently — an attacker-controlled resolver
 * answers the first query with a public IP and the second with an internal one, and the connection
 * lands on loopback/metadata. Here the resolution and the connection share ONE lookup: the custom
 * `lookup` below resolves once, rejects any private/reserved answer (same table as the onboarding
 * guard), and hands the validated address straight to the socket. TLS SNI and the Host header use
 * the original hostname, so certificate verification is unaffected.
 *
 * Redirects are never followed (a 3xx is a delivery failure) and non-https targets are refused
 * unless `allowInsecure` (the dev/test escape hatch) is set.
 */
export interface PostResult {
  ok: boolean;
  status: number;
  error: string | null;
}

export interface PostOptions {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
  allowInsecure: boolean;
}

export function postWebhook(opts: PostOptions): Promise<PostResult> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(opts.url);
    } catch {
      resolve({ ok: false, status: 0, error: 'invalid webhook URL' });
      return;
    }
    if (opts.allowInsecure) {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        resolve({ ok: false, status: 0, error: 'webhookUrl must use http or https' });
        return;
      }
    } else if (url.protocol !== 'https:') {
      resolve({ ok: false, status: 0, error: 'webhookUrl must use https' });
      return;
    }

    const host = url.hostname.replace(/^\[|\]$/g, '');

    // Literal addresses never reach the custom `lookup` (Node dials them directly, skipping the
    // callback entirely), so they must be rejected here — before any socket is opened.
    if (!opts.allowInsecure && isIP(host) !== 0 && isPrivateIp(host)) {
      resolve({ ok: false, status: 0, error: `webhookUrl host ${host} is a private/reserved IP` });
      return;
    }

    const transport = url.protocol === 'https:' ? https : http;
    const requestOpts: https.RequestOptions = {
      method: 'POST',
      protocol: url.protocol,
      hostname: host,
      port: url.port ? Number(url.port) : undefined,
      path: `${url.pathname}${url.search}`,
      headers: opts.headers,
      timeout: opts.timeoutMs,
      // TLS SNI / certificate hostname: the original name, never the resolved address.
      servername: url.protocol === 'https:' ? host : undefined,
    };

    if (!opts.allowInsecure) {
      requestOpts.lookup = guardedLookup();
    }

    const req = transport.request(requestOpts, (res) => {
      // Drain the response so the socket is reusable, but never follow a redirect.
      res.resume();
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        resolve({ ok: false, status, error: 'unexpected redirect (not followed)' });
        return;
      }
      resolve({ ok: status >= 200 && status < 300, status, error: status >= 200 ? null : `HTTP ${status}` });
    });

    const fail = (error: string | null) => {
      resolve({ ok: false, status: 0, error: error ?? 'request failed' });
    };

    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (err) => {
      if (err instanceof UnsafeWebhookUrlError) fail(err.message);
      else if ((err as Error).message === 'timeout') fail('timeout');
      else fail((err as Error).message);
    });

    req.end(opts.body);
  });
}

/** Lookup compatible with Node's `all: true` contract (address list in the callback). */
type AddressResolver = (
  hostname: string,
  options: dns.LookupAllOptions,
  callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void,
) => void;

/** Single DNS resolution shared with the socket dial; rejects private/reserved answers.
 *  Honors Node's `options.all` contract: the autoSelectFamily (Happy Eyeballs) path calls the
 *  lookup with `all: true` and expects the FULL validated address list back — returning a single
 *  string there makes Node iterate it character-by-character and fail with "Invalid IP address:
 *  undefined". */
export function guardedLookup(
  resolve: AddressResolver = dns.lookup,
): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, { all: true, verbatim: true }, (err, addresses) => {
      if (err) {
        callback(err as NodeJS.ErrnoException, undefined as unknown as string, 0);
        return;
      }
      const valid = addresses.filter((a) => !isPrivateIp(a.address));
      if (valid.length === 0) {
        callback(
          new UnsafeWebhookUrlError(
            `webhookUrl host ${hostname} resolves only to private/reserved addresses`,
          ),
          undefined as unknown as string,
          0,
        );
        return;
      }
      if (options.all) {
        callback(null, valid as unknown as string, 0);
        return;
      }
      callback(null, valid[0]!.address, valid[0]!.family);
    });
  };
}