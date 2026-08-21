/**
 * Webhook URL helpers shared by onboarding and dashboard settings.
 *
 * Merchants think in domains ("myshop.com"), not paths. Both UIs therefore accept either:
 *   - a bare domain / host        → completed to https://<host>/webhooks/paywithquai
 *   - a full URL                  → used as-is (power users, custom receivers)
 * http:// is only kept for local hosts (localhost / 127.x.x.x), matching the relayer's
 * SSRF policy which requires HTTPS everywhere else.
 */

/** The path the relayer expects merchant receivers on by default (see docs page example). */
export const DEFAULT_WEBHOOK_PATH = "/webhooks/paywithquai";

function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host.startsWith("127.") ||
    host === "[::1]"
  );
}

/**
 * Completes a bare domain into the default webhook URL and validates the result.
 * Throws an Error with user-facing copy when the input can't form a usable URL.
 */
export function normalizeWebhookInput(raw: string): string {
  let input = raw.trim();
  if (!input) {
    throw new Error("Enter your domain — e.g. myshop.com.");
  }

  // Remember whether the merchant explicitly asked for http:// (local testing).
  const explicitHttp = /^http:\/\//i.test(input);
  input = input.replace(/^https?:\/\//i, "").replace(/\/+$/, "");

  // A path after the host means the merchant pasted (or typed) a full target — keep it.
  const withPath = input.includes("/") ? input : `${input}${DEFAULT_WEBHOOK_PATH}`;
  const scheme = explicitHttp || isLocalHost(withPath) ? "http" : "https";
  const candidate = `${scheme}://${withPath}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`"${raw.trim()}" doesn't look like a domain — try e.g. myshop.com.`);
  }
  if (!parsed.hostname.includes(".") && !isLocalHost(parsed.hostname)) {
    throw new Error(`"${parsed.hostname}" isn't a valid domain — include the TLD, e.g. myshop.com.`);
  }
  return parsed.toString();
}

/** Non-throwing variant for live previews — returns null while the input is still incomplete. */
export function webhookUrlPreview(raw: string): string | null {
  try {
    return normalizeWebhookInput(raw);
  } catch {
    return null;
  }
}
