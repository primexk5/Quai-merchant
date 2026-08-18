/**
 * blip.ts — Blip Pay wallet utilities
 *
 * Blip is an iPhone self-custody wallet for Quai that injects window.quai
 * inside its built-in browser, making it behave like any EIP-1193 extension.
 *
 * On desktop, we can deep-link users into the Blip app via QR code.
 * URI scheme confirmed from blippay.me: blip://open opens the app.
 *
 * NOTE: A dedicated blip://connect?callbackUrl=... scheme is not yet publicly
 * documented. The QR on the login/onboarding pages currently encodes
 * blip://open so users land inside the Blip browser, then tap "Connect."
 * Update this file once the Blip team publishes the connection URI scheme.
 */

/** True when running inside Blip's built-in browser (window.quai is injected). */
export function isInsideBlipBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.quai;
}

/**
 * Returns a deep-link that opens the Blip iOS app.
 * On desktop encode this as a QR code; on mobile use as <a href>.
 */
export function blipOpenDeepLink(hint?: string): string {
  const base = "blip://open";
  if (!hint) return base;
  return `${base}?ref=${encodeURIComponent(hint)}`;
}

/** True on mobile-class viewports. */
export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
}
