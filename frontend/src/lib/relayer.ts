"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_API_KEY, backendFetch } from "@/lib/payment";

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

async function adminGet<T>(path: string): Promise<T> {
  const res = await backendFetch(path, {
    headers: { authorization: `Bearer ${ADMIN_API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`backend error ${res.status}`);
  return (await res.json()) as T;
}

export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await backendFetch(path, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${ADMIN_API_KEY}`,
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

/** Live deliveries + merchants from the relayer backend, auto-refreshing. */
export function useRelayerData(intervalMs = 8000) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([
        adminGet<{ deliveries: Delivery[] }>("/v1/deliveries"),
        adminGet<{ merchants: Merchant[] }>("/v1/merchants"),
      ]);
      setDeliveries(d.deliveries);
      setMerchants(m.merchants);
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