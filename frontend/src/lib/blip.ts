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
 * Blip app-wallet support (https://blippay.me/docs).
 *
 * Inside the Blip browser the provider exposes a PER-ORIGIN "app wallet" — a deterministic
 * EOA derived from the user's mnemonic, NOT their main vault. It is frequently empty, so
 * before asking it to sign a payment we check its balance and use Blip's funding protocol
 * (`wallet_getProviderState` → `blip_requestAppWalletFunding`) to top it up from the main
 * vault. Native-QUAI top-ups within the user's per-app limit (default 1000 QUAI) are silent;
 * anything else shows Blip's approval sheet.
 */

/** Shape of the `wallet_getProviderState` response (documented subset). */
export interface BlipProviderState {
  wallet?: string;
  accounts?: string[];
  chainId?: string;
  isConnected?: boolean;
  isUnlocked?: boolean;
  appWallet?: {
    connected?: boolean;
    address?: string;
    autoTopUpEnabled?: boolean;
    nativeAutoTopUpLimitWei?: string;
  };
  features?: {
    appWalletNativeTopUp?: boolean;
    appWalletTokenFunding?: boolean;
  };
}

/** Params for `blip_requestAppWalletFunding`. */
export interface BlipFundingAsset {
  type: "native" | "erc20";
  /** Display metadata — optional per the docs' asset shape. */
  symbol?: string;
  decimals?: number;
  /** Hex quantity — `amountWei` for native, `amount` for ERC-20. */
  amountWei?: string;
  amount?: string;
  token?: string;
  purpose?: string;
}

export interface BlipFundingRequest {
  chainId: string;
  reason: string;
  continueLabel?: string;
  assets: BlipFundingAsset[];
}

export interface BlipFundingResult {
  funded?: boolean;
  txHashes?: string[];
  balances?: Record<string, string>;
}

function asBlipError(err: unknown): { code?: number; message?: string } {
  const e = err as { code?: number; message?: string };
  return { code: e?.code, message: e?.message };
}

/**
 * Discovers the app-wallet state. Returns null when the method isn't available
 * (e.g. an older Blip build or another Quai wallet) so callers can skip funding gracefully.
 */
export async function getBlipProviderState(
  provider: Eip1193Provider,
): Promise<BlipProviderState | null> {
  try {
    const state = await provider.request({ method: "wallet_getProviderState" });
    return (state as BlipProviderState) ?? null;
  } catch {
    // Method unsupported — treat "no app-wallet info" as "nothing to do".
    return null;
  }
}

/** Reads the app wallet's native QUAI balance via the documented `quai_getBalance`. */
export async function getWalletQuaiBalance(
  provider: Eip1193Provider,
  address: string,
): Promise<bigint | null> {
  try {
    const wei = await provider.request({
      method: "quai_getBalance",
      params: [address, "latest"],
    });
    return typeof wei === "string" ? BigInt(wei) : null;
  } catch {
    return null; // balance unknown — callers proceed and let the send surface any failure
  }
}

/** Funding error codes from the docs: 4001 rejected, -32010 main-vault too light. */
export class BlipFundingError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "BlipFundingError";
  }
}

/**
 * Asks Blip to move funds from the user's main vault into this origin's app wallet.
 * Throws {@link BlipFundingError} when the user declines or the main vault can't cover it.
 * Resolves silently (auto-top-up) when within the user's per-app limit.
 */
export async function requestAppWalletFunding(
  provider: Eip1193Provider,
  req: BlipFundingRequest,
): Promise<BlipFundingResult | null> {
  try {
    const res = await provider.request({
      method: "blip_requestAppWalletFunding",
      params: [req],
    });
    return (res as BlipFundingResult) ?? null;
  } catch (err) {
    const { code } = asBlipError(err);
    if (code === 4001) {
      throw new BlipFundingError("Top-up declined — the app wallet doesn't have enough QUAI.", code);
    }
    if (code === -32010) {
      throw new BlipFundingError(
        "Your Blip main vault doesn't have enough QUAI to fund this site's wallet.",
        code,
      );
    }
    if (code === 4100) {
      throw new BlipFundingError("Blip app wallet is unavailable for this site.", code);
    }
    throw err instanceof Error ? err : new Error(asBlipError(err).message ?? "Funding failed");
  }
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
