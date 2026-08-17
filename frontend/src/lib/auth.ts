"use client";

import { BrowserProvider } from "quais";
import { backendFetch } from "@/lib/payment";
import { connectWallet, ensureQuaiNetwork, getActiveWallet } from "@/lib/wallets";

const TOKEN_KEY = "quaimerchant.token";
const ADDRESS_KEY = "quaimerchant.address";

export interface AuthMerchant {
  merchantId: string;
  address: string;
  name: string;
  webhookUrl: string;
  active: boolean;
  createdAt: number;
}

export interface LoginResult {
  token: string;
  expiresAt: number;
  merchant: AuthMerchant;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getStoredToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredAddress(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(ADDRESS_KEY);
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getStoredToken() !== null;
}

/**
 * Signs the login challenge with the active wallet and exchanges it for a session token.
 * The message embeds the current unix time so the backend can reject replayed signatures.
 */
export async function loginWithWallet(): Promise<LoginResult> {
  const wallet = getActiveWallet();
  if (!wallet) {
    throw new Error("No wallet connected — connect a wallet first.");
  }
  await ensureQuaiNetwork(wallet.provider);
  const address = await connectWallet(wallet);

  const provider = new BrowserProvider(wallet.provider);
  const signer = await provider.getSigner();
  const ts = Math.floor(Date.now() / 1000);
  const message = `quai-merchant-login:${address}:${ts}`;
  const signature = await signer.signMessage(message);

  const res = await backendFetch("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, message, signature }),
  });

  let body: { token?: string; expiresAt?: number; merchant?: AuthMerchant; error?: string };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    body = {};
  }
  if (!res.ok) {
    throw new Error(body.error ?? `login failed (${res.status})`);
  }
  if (!body.token || !body.merchant) {
    throw new Error("login response missing token");
  }

  try {
    localStorage.setItem(TOKEN_KEY, body.token);
    localStorage.setItem(ADDRESS_KEY, address);
  } catch {
    // storage unavailable — the session just won't survive a reload
  }
  return { token: body.token, expiresAt: body.expiresAt ?? 0, merchant: body.merchant };
}

/** Clears the stored session; best-effort invalidates it server-side. */
export async function logout(): Promise<void> {
  const token = getStoredToken();
  if (isBrowser()) {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADDRESS_KEY);
    } catch {
      // ignore
    }
  }
  if (!token) return;
  try {
    await backendFetch("/v1/auth/logout", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // server unreachable — the token is gone locally anyway
  }
}