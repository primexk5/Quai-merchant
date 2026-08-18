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

/** Comma-separated fallback list, e.g. "http://localhost:8080,https://quai-merchant.onrender.com".
 *  Each request tries the backends in order and uses the first that is reachable. */
export const BACKEND_URLS = BACKEND_URL.split(",")
  .map((u) => u.trim())
  .filter(Boolean);

/** HTTP statuses that mean the host is up but failing — try the next backend URL. */
const FAILOVER_STATUSES = new Set([502, 503, 504]);

/** Fetch against the first reachable backend URL. Network failures and 502/503/504 fall
 *  through to the next candidate; other HTTP responses are returned as-is.
 *
 *  `credentials: "include"` makes the browser send (and store) the HttpOnly session cookie the
 *  backend issues at login — cross-origin, thanks to the backend's CORS + SameSite settings.
 *  NOTE: this module is imported by client components, so no secret may ever live here. */
export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  let lastResponse: Response | undefined;
  for (const base of BACKEND_URLS) {
    try {
      const res = await fetch(`${base}${path}`, { credentials: "include", ...init });
      if (FAILOVER_STATUSES.has(res.status)) {
        lastResponse = res;
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastResponse) return lastResponse;
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

/** Orders are keyed by msg.sender on-chain — the connected wallet must match `merchant`. */
async function assertMerchantSigner(signer: Signer, merchant: string): Promise<void> {
  const connected = (await signer.getAddress()).toLowerCase();
  if (connected !== merchant.toLowerCase()) {
    throw new Error(
      `Connected wallet (${connected}) does not match the merchant address (${merchant}).`,
    );
  }
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
  await assertMerchantSigner(signer, merchant);
  const tx = await getContract(signer).registerOrder(orderId, token, amount, expiry);
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Merchant registers an order that only `expectedPayer` may settle (anti-front-running for
 *  prepaid/invoice flows). Zero address = anyone may pay (same as registerOrder). */
export async function registerOrderWithPayer(
  merchant: string,
  orderId: string,
  token: string,
  amount: bigint,
  expiry: bigint,
  expectedPayer: string,
): Promise<string> {
  const signer = await getSigner();
  await assertMerchantSigner(signer, merchant);
  const tx = await getContract(signer).registerOrderWithPayer(
    orderId,
    token,
    amount,
    expiry,
    expectedPayer,
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Customer settles an ERC-20 order (approve + payOrder). Returns the tx receipt. */
export async function payOrder(
  merchant: string,
  orderId: string,
  token: string,
  amount: bigint,
): Promise<string> {
  const signer = await getSigner();
  const contract = getContract(signer);
  await (await new Contract(token, [
    "function approve(address spender, uint256 amount) returns (bool)",
  ], signer).approve(PAYWITHQUAI_ADDRESS, amount)).wait();
  const tx = await contract.payOrder(merchant, orderId);
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Customer settles a native QUAI order. Returns the tx receipt. */
export async function payOrderNative(
  merchant: string,
  orderId: string,
  amount: bigint | string,
): Promise<string> {
  const signer = await getSigner();
  const value = typeof amount === "bigint" ? amount : parseQuai(amount);
  const tx = await getContract(signer).payOrderNative(merchant, orderId, {
    value,
  });
  const receipt = await tx.wait();
  return receipt.hash;
}

/** Cryptographically random order id — Math.random()/timestamps are predictable, and the id is
 *  bound to a real on-chain order (a guessed id is also a DoS vector on the order-lookup API). */
export function newOrderId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return id(`ord_web_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`);
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

export interface OnChainOrder {
  merchant: string;
  settled: boolean;
  exists: boolean;
  feeBps: number;
  token: string;
  amount: bigint;
  expiry: bigint;
  feeRecipient: string;
  settledAt: bigint;
  expectedPayer: string;
  nonce: bigint;
}

/** Raw order read from the contract (authoritative display + expectedPayer). */
export async function getOrderOnChain(
  merchant: string,
  orderId: string,
): Promise<OnChainOrder | null> {
  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL!, undefined, {
    usePathing: true,
  });
  const contract = new Contract(PAYWITHQUAI_ADDRESS, paywithquaiAbi, provider);
  const o = (await contract.getOrder(merchant, orderId)) as Record<string, unknown>;
  return {
    merchant,
    settled: Boolean(o.settled),
    exists: Boolean(o.exists),
    feeBps: Number(o.feeBps as bigint),
    token: o.token as string,
    amount: o.amount as bigint,
    expiry: o.expiry as bigint,
    feeRecipient: o.feeRecipient as string,
    settledAt: o.settledAt as bigint,
    expectedPayer: o.expectedPayer as string,
    nonce: o.nonce as bigint,
  };
}

export interface ConfirmationResult {
  backend: boolean;
  settledOnChain: boolean;
  webhookDelivered: boolean;
}

/** Poll until the relayer confirms the webhook. On-chain settlement alone is not treated as
 *  complete — merchants should fulfill on the signed webhook, not just a chain read. */
export async function waitForConfirmation(
  merchant: string,
  orderId: string,
  onProgress?: (webhookStatus: string | null) => void,
  maxSeconds = 120,
): Promise<ConfirmationResult> {
  const deadline = Date.now() + maxSeconds * 1000;
  let backendOk = false;
  let settledOnChain = false;
  while (Date.now() < deadline) {
    try {
      const order = await fetchOrderStatus(merchant, orderId);
      if (order) {
        onProgress?.(order.webhook?.status ?? null);
        if (order.settled && order.webhook?.status === "delivered") {
          return { backend: true, settledOnChain: true, webhookDelivered: true };
        }
        backendOk = true;
        if (order.settled) settledOnChain = true;
      }
    } catch {
      // backend unreachable — fall back to on-chain reads below
    }
    if (!settledOnChain) {
      settledOnChain = await isSettledOnChain(merchant, orderId).catch(() => false);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  if (!settledOnChain) {
    settledOnChain = await isSettledOnChain(merchant, orderId).catch(() => false);
  }
  return { backend: backendOk, settledOnChain, webhookDelivered: false };
}

export { formatQuai, parseQuai };