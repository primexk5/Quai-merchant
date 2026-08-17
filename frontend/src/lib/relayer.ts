"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_API_KEY, backendFetch } from "@/lib/payment";
import { getStoredToken } from "@/lib/auth";

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

/** Bearer token for admin calls: the session token when logged in, else the demo admin key. */
function adminHeaders(): Record<string, string> {
  const token = getStoredToken();
  return { authorization: `Bearer ${token ?? ADMIN_API_KEY}` };
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await backendFetch(path, {
    headers: adminHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`backend error ${res.status}`);
  return (await res.json()) as T;
}

export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await backendFetch(path, {
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
 *  Logged-in merchants see only their own data (via /v1/me); without a session the
 *  demo admin key is used to read everything. */
export function useRelayerData(intervalMs = 8000) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (getStoredToken()) {
        const [me, d] = await Promise.all([
          adminGet<Merchant>("/v1/me"),
          adminGet<{ deliveries: Delivery[] }>("/v1/me/deliveries"),
        ]);
        setDeliveries(d.deliveries);
        setMerchants([me]);
      } else {
        const [d, m] = await Promise.all([
          adminGet<{ deliveries: Delivery[] }>("/v1/deliveries"),
          adminGet<{ merchants: Merchant[] }>("/v1/merchants"),
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

export function formatDeliveryAmount(net: string, token: string): string {
  const value = BigInt(net);
  if (token === "0x0000000000000000000000000000000000000000") {
    return `${Number(value) / 1e18} QUAI`;
  }
  return `${Number(value) / 1e6} mUSDQ`;
}

export function formatTimestamp(msOrSec: number): string {
  const ms = msOrSec > 1e12 ? msOrSec : msOrSec * 1000;
  return new Date(ms).toLocaleString();
}