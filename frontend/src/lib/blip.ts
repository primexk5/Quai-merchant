/**
 * blip.ts — Blip Pay wallet utilities
 *
 * Blip is a self-custody mobile wallet for Quai (available on iOS and Android)
 * that injects window.quai inside its built-in browser, making it behave like
 * any EIP-1193 extension.
 *
 * On desktop, we can deep-link users into the Blip app via QR code.
 * URI scheme confirmed from blippay.me: blip://open opens the app.
 *
 * NOTE: A dedicated blip://connect?callbackUrl=... scheme is not yet publicly
 * documented. The QR on the login/onboarding pages currently encodes
 * blip://open so users land inside the Blip browser, then tap "Connect."
 * Update this file once the Blip team publishes the connection URI scheme.
 */

import { useState, useEffect } from "react";

/** True when running inside Blip's built-in browser (window.quai is injected). */
export function isInsideBlipBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.quai;
}

/** True on mobile-class viewports. */
export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
}

/**
 * Hook to safely retrieve Blip environment variables on the client
 * without causing React hydration mismatches between Server/Client renders.
 */
export function useBlipContext() {
  const [insideBlip, setInsideBlip] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Default fallback for SSR
  const [blipLink, setBlipLink] = useState("https://blippay.me");

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      setInsideBlip(isInsideBlipBrowser());
      setIsMobile(isMobileViewport());
      // Blip's universal link to open a specific URL in their in-app browser
      setBlipLink(`https://blippay.me/browser?url=${encodeURIComponent(window.location.href)}`);
    })();
  }, []);

  return { insideBlip, isMobile, blipLink };
}
