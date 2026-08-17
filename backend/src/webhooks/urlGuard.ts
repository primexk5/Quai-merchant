import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

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
 *      DNS-rebinding hole (a name that was public at onboarding but later re-points inward).
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
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 — private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 — benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 — TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 — TEST-NET-3
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved + 255.255.255.255
  return false;
}

/**
 * True if an IP literal (v4 or v6) is in a private/loopback/link-local/ULA/reserved range — i.e.
 * anything that could reach the relayer host's own network rather than the public internet. An
 * unparseable input is treated as unsafe (fail closed).
 */
export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const o = ipv4Octets(ip);
    return o ? ipv4IsPrivate(o[0], o[1], o[2]) : true;
  }
  if (kind === 6) {
    let v6 = ip.toLowerCase();
    const pct = v6.indexOf('%'); // strip a zone id, e.g. fe80::1%eth0
    if (pct !== -1) v6 = v6.slice(0, pct);
    // IPv4-mapped / -compatible forms (::ffff:127.0.0.1, ::127.0.0.1): validate the embedded v4.
    const tail = v6.slice(v6.lastIndexOf(':') + 1);
    if (tail.includes('.')) return isPrivateIp(tail);
    if (v6 === '::' || v6 === '::1') return true; // unspecified / loopback
    if (v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb')) {
      return true; // fe80::/10 — link-local
    }
    if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // fc00::/7 — unique-local
    if (v6.startsWith('ff')) return true; // ff00::/8 — multicast
    return false;
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
