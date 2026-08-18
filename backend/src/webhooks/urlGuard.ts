import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

/**
 * SSRF protection for merchant-supplied webhook URLs.
 *
 * A merchant controls its `webhookUrl`, and the relayer makes an authenticated outbound POST to it
 * from inside our network. Without guarding, a merchant could point that URL at `http://169.254.169.254`
 * (cloud metadata), `http://127.0.0.1:<admin-port>`, or an internal service and use the relayer as a
 * confused deputy. Two layers defend against this:
 *
 *   1. {@link assertSafeWebhookUrl} — a synchronous, DNS-free check at onboarding / update time:
 *      require https and reject obviously-internal hosts.
 *   2. {@link assertResolvesPublic} — an async check run again immediately before every delivery:
 *      resolve the host and refuse if it maps to a private/reserved address. This is what closes the
 *      DNS-rebinding hole (a name that was public at onboarding but later re-points inward). The
 *      dispatcher additionally performs the resolution and the connection atomically through a
 *      single `lookup` (see webhooks/httpPost.ts), so a rebinding race cannot slip a private address
 *      through between the check and the dial.
 *
 * Both are bypassed when `allowInsecure` is true, the dev/test escape hatch controlled by
 * `WEBHOOK_ALLOW_INSECURE_URLS` (so a local `http://localhost:9000` receiver still works).
 */
export class UnsafeWebhookUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeWebhookUrlError';
  }
}

/** Parse a dotted-quad IPv4 string into four octets, or null if malformed. */
function ipv4Octets(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return octets as [number, number, number, number];
}

/** True if an IPv4 address is in any non-public range we must never deliver to. */
function ipv4IsPrivate(a: number, b: number, c: number): boolean {
  if (a === 0) return true; // 0.0.0.0/8 — "this network"
  if (a === 10) return true; // 10.0.0.0/8 — private
  if (a === 127) return true; // 127.0.0.0/8 — loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 — CGNAT
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 — link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 — private
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 — IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 — TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true; // 192.88.99.0/24 — 6to4 relay anycast
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 — private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 — benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 — TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 — TEST-NET-3
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + 255.255.255.255
  return false;
}

/** Validate the 4-byte tail of an IPv4-embedded IPv6 address (mapped/compatible/NAT64 forms). */
function ipv4FromLastHextets(parts: number[]): boolean {
  const tail = parts.slice(-2);
  const hi = tail[0];
  const lo = tail[1];
  if (hi === undefined || lo === undefined) return true;
  return ipv4IsPrivate(hi >> 8, hi & 0xff, lo >> 8);
}

/**
 * True if an IP literal (v4 or v6) is in a private/loopback/link-local/ULA/reserved range — i.e.
 * anything that could reach the relayer host's own network rather than the public internet. An
 * unparseable input is treated as unsafe (fail closed).
 *
 * IPv6 is parsed properly (ipaddr.js) so hex-encoded IPv4-embedded forms cannot sneak through:
 * `::ffff:7f00:1`, `::7f00:1`, `64:ff9b::7f00:1`, `2002:7f00:1::1`, `2001::4136:…` (Teredo) all
 * resolve to their embedded IPv4 and are classified by the same table as plain IPv4.
 */
export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const o = ipv4Octets(ip);
    return o ? ipv4IsPrivate(o[0], o[1], o[2]) : true;
  }
  if (kind === 6) {
    let addr: ipaddr.IPv6;
    try {
      // Strip a zone id (e.g. fe80::1%eth0) before parsing — DNS answers never carry one, and
      // ipaddr rejects the "%" form on some inputs.
      addr = ipaddr.parse((ip.split('%')[0] ?? ip)) as ipaddr.IPv6;
    } catch {
      return true; // fail closed
    }
    const range = addr.range();
    if (['unspecified', 'loopback', 'linkLocal', 'uniqueLocal', 'multicast', 'reserved'].includes(range)) {
      return true;
    }
    if (range === 'ipv4Mapped') {
      return isPrivateIp(addr.toIPv4Address().toNormalizedString());
    }
    // IPv4-compatible (::x.x.x.x, deprecated but dialable on Linux): first six hextets are zero.
    if (addr.parts.slice(0, 6).every((h) => h === 0)) {
      return ipv4FromLastHextets(addr.parts);
    }
    // rfc6145 (::ffff:0:0/96) and rfc6052 (64:ff9b::/96) NAT64: IPv4 in the last 4 bytes.
    if (range === 'rfc6145' || range === 'rfc6052') {
      return ipv4FromLastHextets(addr.parts);
    }
    if (range === '6to4') {
      // 2002:V4a:V4b::/48 — the embedded IPv4 lives in hextets 2-3.
      const a = addr.parts[2];
      const b = addr.parts[3];
      if (a === undefined || b === undefined) return true;
      return ipv4IsPrivate(a >> 8, a & 0xff, b >> 8);
    }
    if (range === 'teredo') {
      // 2001::/32 — the client's IPv4 is the last 4 bytes.
      return ipv4FromLastHextets(addr.parts);
    }
    return false; // 'unicast' — globally routable
  }
  return true; // not a valid IP literal
}

/**
 * Synchronous, DNS-free safety check for a merchant-supplied webhook URL, run at onboarding /
 * update time. Enforces https and rejects obviously-internal hosts. The authoritative anti-rebinding
 * check happens again at delivery time in {@link assertResolvesPublic}.
 */
export function assertSafeWebhookUrl(rawUrl: string, allowInsecure: boolean): void {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new UnsafeWebhookUrlError('webhookUrl must be a valid absolute URL');
  }
  if (allowInsecure) {
    // Dev/test escape hatch: still require http(s), but skip the https + private-range checks.
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new UnsafeWebhookUrlError('webhookUrl must use http or https');
    }
    return;
  }
  if (u.protocol !== 'https:') {
    throw new UnsafeWebhookUrlError('webhookUrl must use https');
  }
  const host = u.hostname.replace(/^\[|\]$/g, ''); // URL wraps IPv6 literals in [brackets]
  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal')) {
    throw new UnsafeWebhookUrlError('webhookUrl must not target a loopback/internal hostname');
  }
  if (isIP(host) && isPrivateIp(host)) {
    throw new UnsafeWebhookUrlError('webhookUrl must not target a private, loopback or reserved IP');
  }
}

/**
 * Delivery-time guard against SSRF / DNS rebinding: resolve the host and refuse if *any* returned
 * address is private/reserved. Called immediately before the outbound fetch, so a hostname that was
 * public at onboarding but later re-points at an internal address is still blocked.
 */
export async function assertResolvesPublic(hostname: string, allowInsecure: boolean): Promise<void> {
  if (allowInsecure) return;
  const host = hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (isPrivateIp(host)) {
      throw new UnsafeWebhookUrlError(`webhookUrl host ${host} is a private/reserved IP`);
    }
    return; // public IP literal — no DNS needed
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new UnsafeWebhookUrlError(`webhookUrl host ${host} could not be resolved`);
  }
  for (const { address } of addrs) {
    if (isPrivateIp(address)) {
      throw new UnsafeWebhookUrlError(`webhookUrl host ${host} resolves to a private/reserved address (${address})`);
    }
  }
}
