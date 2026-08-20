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
import type { Eip1193Provider } from "@/lib/wallets";

/** True when running inside Blip's built-in browser (window.quai is injected). */
export function isInsideBlipBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const quai = window.quai as
    | (Eip1193Provider & { isBlip?: boolean; _isSwiftBlip?: boolean })
    | undefined;
  if (!quai) return false;
  // Blip injects window.quai and marks itself with isBlip / _isSwiftBlip. It ALSO sets
  // isPelagus:true for Pelagus compatibility, so we must NOT treat isPelagus as
  // "not Blip" — only a bare Pelagus extension (no Blip flags) is a desktop wallet.
  return Boolean(quai.isBlip || quai._isSwiftBlip);
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

/** Direct deep link into Blip's in-app browser — skips the blippay.me landing page. */
export function blipDeepLink(pageUrl: string): string {
  return `blip://browser?url=${encodeURIComponent(pageUrl)}`;
}

/**
 * Hook to safely retrieve Blip environment variables on the client
 * without causing React hydration mismatches between Server/Client renders.
 */
export function useBlipContext() {
  const [insideBlip, setInsideBlip] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [blipLink, setBlipLink] = useState("https://blippay.me");
  const [blipDeep, setBlipDeep] = useState("https://blippay.me");

  useEffect(() => {
    let attempts = 0;
    const check = () => {
      setInsideBlip(isInsideBlipBrowser());
      setIsMobile(isMobileViewport());
      setBlipLink(blipBrowserLink(window.location.href));
      setBlipDeep(blipDeepLink(window.location.href));
    };
    check();
    // Blip's in-app browser can inject window.quai a moment after first paint —
    // keep checking so the "connect in one tap" panel appears instead of the loop.
    const timer = setInterval(() => {
      check();
      if (isInsideBlipBrowser() || ++attempts > 10) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return { insideBlip, isMobile, blipLink, blipDeep };
}
