import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatQuai,
  id,
  parseQuai,
  type Signer,
} from "quais";
import paywithquaiAbi from "./paywithquai.abi.json";
import { getActiveWallet } from "./wallets";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const PAYWITHQUAI_ADDRESS = process.env.NEXT_PUBLIC_PAYWITHQUAI_ADDRESS!;
export const MUSDQ_ADDRESS = process.env.NEXT_PUBLIC_MUSDQ_ADDRESS!;
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;
export const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY!;

/** Comma-separated fallback list, e.g. "http://localhost:8080,https://quai-merchant.onrender.com".
 *  Each request tries the backends in order and uses the first that is reachable. */
export const BACKEND_URLS = BACKEND_URL.split(",")
  .map((u) => u.trim())
  .filter(Boolean);

/** Fetch against the first reachable backend URL. Network failures fall through to the next
 *  candidate; any HTTP response (even 4xx/5xx) counts as "reached" and is returned as-is. */
export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (const base of BACKEND_URLS) {
    try {
      return await fetch(`${base}${path}`, init);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("backend unreachable");
}

async function getSigner(): Promise<Signer> {
  const wallet = getActiveWallet();
  if (!wallet) {
    throw new Error("No wallet connected — connect a wallet first.");
  }
  const provider = new BrowserProvider(wallet.provider);
  return provider.getSigner();
}

function getContract(signer?: Signer): Contract {
  return new Contract(PAYWITHQUAI_ADDRESS, paywithquaiAbi, signer);
}

/** Merchant registers an order on-chain. Returns the tx receipt. */
export async function registerOrder(
  merchant: string,
  orderId: string,
  token: string,
  amount: bigint,
  expiry = 0n,
): Promise<string> {
  const signer = await getSigner();
  const tx = await getContract(signer).registerOrder(orderId, token, amount, expiry);
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Customer settles a native QUAI order. Returns the tx receipt. */
export async function payOrderNative(
  merchant: string,
  orderId: string,
  amountQuai: string,
): Promise<string> {
  const signer = await getSigner();
  const tx = await getContract(signer).payOrderNative(merchant, orderId, {
    value: parseQuai(amountQuai),
  });
  const receipt = await tx.wait();
  return receipt.hash;
}

export function newOrderId(): string {
  return id(`ord_web_${Date.now()}_${Math.random()}`);
}

export interface OrderStatus {
  merchant: string;
  orderId: string;
  token: string;
  amount: string;
  feeBps: number;
  expiry: string;
  settled: boolean;
  webhook: { status: string; attempts: number } | null;
}

/** Settlement status from the relayer backend (final source of truth). */
export async function fetchOrderStatus(
  merchant: string,
  orderId: string,
): Promise<OrderStatus | null> {
  const res = await backendFetch(
    `/v1/orders/${merchant}/${orderId}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`backend error ${res.status}`);
  return (await res.json()) as OrderStatus;
}

/** On-chain fallback when the backend is unreachable. */
export async function isSettledOnChain(
  merchant: string,
  orderId: string,
): Promise<boolean> {
  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL!, undefined, {
    usePathing: true,
  });
  const contract = new Contract(PAYWITHQUAI_ADDRESS, paywithquaiAbi, provider);
  return (await contract.isSettled(merchant, orderId)) as boolean;
}

/** Poll until the relayer confirms the webhook, with a settled fallback. */
export async function waitForConfirmation(
  merchant: string,
  orderId: string,
  onProgress?: (webhookStatus: string | null) => void,
  maxSeconds = 120,
): Promise<{ backend: boolean; settledOnChain: boolean }> {
  const deadline = Date.now() + maxSeconds * 1000;
  let backendOk = false;
  while (Date.now() < deadline) {
    try {
      const order = await fetchOrderStatus(merchant, orderId);
      if (order) {
        onProgress?.(order.webhook?.status ?? null);
        if (order.settled && order.webhook?.status === "delivered") {
          return { backend: true, settledOnChain: true };
        }
        backendOk = true;
      }
    } catch {
      // backend unreachable — fall back to on-chain reads below
    }
    const onChain = await isSettledOnChain(merchant, orderId).catch(() => false);
    if (onChain) return { backend: backendOk, settledOnChain: true };
    await new Promise((r) => setTimeout(r, 4000));
  }
  const settledOnChain = await isSettledOnChain(merchant, orderId).catch(() => false);
  return { backend: backendOk, settledOnChain };
}

export { formatQuai, parseQuai };