"use client";

import { useCallback, useEffect, useState } from "react";
import { formatQuai, formatUnits } from "quais";
import { backendFetch } from "@/lib/payment";
import { getSessionToken, isLoggedIn } from "@/lib/auth";

export interface DeliveryData {
  merchant: string;
  orderId: string;
  payer: string;
  token: string;
  amount: string;
  feeBps: number;
  fee: string;
  net: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

export interface Delivery {
  id: string;
  merchantId: string;
  url: string;
  payload: { type: string; data: DeliveryData };
  status: "pending" | "delivered" | "failed" | "skipped";
  attempts: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Merchant {
  merchantId: string;
  address: string;
  name: string;
  webhookUrl: string;
  active: boolean;
  createdAt: number;
}

/** Session bearer token when available in memory; the HttpOnly cookie covers the rest. */
function adminHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** /api/admin/* hits the Next.js proxy (same-origin); /v1/* hits the Express relayer. */
function relayerFetch(path: string, init?: RequestInit): Promise<Response> {
  if (path.startsWith("/api/")) {
    return fetch(path, { credentials: "include", ...init });
  }
  return backendFetch(path, init);
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await relayerFetch(path, {
    headers: adminHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`backend error ${res.status}`);
  return (await res.json()) as T;
}

export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await relayerFetch(path, {
    method: "PATCH",
    headers: {
      ...adminHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `backend error ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Live deliveries + merchants from the relayer backend, auto-refreshing.
 *  Logged-in merchants see only their own data (via /v1/me, cookie/token-authenticated).
 *  Without a session the demo falls back to the server-side admin proxy (the ADMIN_API_KEY
 *  never touches the browser). */
export function useRelayerData(intervalMs = 8000) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (isLoggedIn()) {
        const [me, d] = await Promise.all([
          adminGet<Merchant>("/v1/me"),
          adminGet<{ deliveries: Delivery[] }>("/v1/me/deliveries"),
        ]);
        setDeliveries(d.deliveries);
        setMerchants([me]);
      } else {
        // Demo mode: proxied server-side with the admin key (see app/api/admin/[...path]/route.ts).
        const [d, m] = await Promise.all([
          adminGet<{ deliveries: Delivery[] }>("/api/admin/deliveries"),
          adminGet<{ merchants: Merchant[] }>("/api/admin/merchants"),
        ]);
        setDeliveries(d.deliveries);
        setMerchants(m.merchants);
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void refresh(), intervalMs);
    const initial = setTimeout(() => void refresh(), 0);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
    };
  }, [refresh, intervalMs]);

  return { deliveries, merchants, loading, error, refresh };
}

/** Exact-decimal amount formatting — Number() division loses precision on big values. */
export function formatDeliveryAmount(net: string, token: string): string {
  if (token === "0x0000000000000000000000000000000000000000") {
    return `${formatQuai(net)} QUAI`;
  }
  return `${formatUnits(net, 6)} mUSDQ`;
}

export function formatTimestamp(msOrSec: number): string {
  const ms = msOrSec > 1e12 ? msOrSec : msOrSec * 1000;
  return new Date(ms).toLocaleString();
}