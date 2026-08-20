/**
 * blip.ts — Blip Pay wallet utilities
 *
 * Blip injects window.quai inside its in-app browser. PayWithQuai checkouts must
 * run there (or in a desktop extension) so payOrderNative settles the order and
 * the relayer fires the merchant webhook — blip://pay send-to-address links do not.
 *
 * Mobile flow: QR / "Open in Blip" → blippay.me/browser?url=<checkout> → user taps Pay
 * in Blip's browser → contract call → webhook → merchant dashboard updates.
 */

import { useState, useEffect } from "react";

/** True when running inside Blip's built-in browser (window.quai is injected). */
export function isInsideBlipBrowser(): boolean {
  if (typeof window === "undefined") return false;
  // Pelagus also injects window.quai for backwards compatibility.
  if (window.quai && (window.quai as { isPelagus?: boolean }).isPelagus) return false;
  return !!window.quai;
}

/** True on mobile-class viewports. */
export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
}

/** Canonical checkout URL — works in any browser wallet or Blip's in-app browser. */
export function checkoutPageUrl(merchant: string, orderId: string): string {
  const path = `/checkout/${merchant}/${orderId}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/** Opens a page inside Blip's in-app browser (iOS & Android). */
export function blipBrowserLink(pageUrl: string): string {
  return `https://blippay.me/browser?url=${encodeURIComponent(pageUrl)}`;
}

/**
 * Hook to safely retrieve Blip environment variables on the client
 * without causing React hydration mismatches between Server/Client renders.
 */
export function useBlipContext() {
  const [insideBlip, setInsideBlip] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [blipLink, setBlipLink] = useState("https://blippay.me");

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      setInsideBlip(isInsideBlipBrowser());
      setIsMobile(isMobileViewport());
      setBlipLink(blipBrowserLink(window.location.href));
    })();
  }, []);

  return { insideBlip, isMobile, blipLink };
}
