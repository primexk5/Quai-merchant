import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatQuai,
  getAddress,
  id,
  parseQuai,
  type Signer,
} from "quais";
import paywithquaiAbi from "./paywithquai.abi.json";
import { getActiveWallet } from "./wallets";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const PAYWITHQUAI_ADDRESS = process.env.NEXT_PUBLIC_PAYWITHQUAI_ADDRESS!;
// Stablecoin deployed alongside PayWithQuai (contracts/deployments/cyprus1.json). Falls back so
// the app keeps working when NEXT_PUBLIC_MUSDQ_ADDRESS is unset — overrides win when set.
export const MUSDQ_ADDRESS =
  process.env.NEXT_PUBLIC_MUSDQ_ADDRESS || "0x003fafB5126a5296c6edC7C23De55daf2E84B503";
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

/** Resolve a NEXT_PUBLIC_* contract address with a clear failure instead of the cryptic
 *  "unsupported addressable value (argument="target", value=null)" thrown by `new Contract(...)`
 *  when the env var is unset (NEXT_PUBLIC_ vars are inlined at build time). */
function requireAddress(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set in the frontend environment. NEXT_PUBLIC_* variables are inlined at ` +
        `build time — add it (see frontend/.env.local.example and frontend/src/app/docs/page.tsx) ` +
        `and redeploy.`,
    );
  }
  try {
    return getAddress(value);
  } catch {
    throw new Error(`${name}=${value} is not a valid address`);
  }
}

/** One provider reused across polls — avoids re-doing DNS/TLS handshakes on every status check,
 *  which matters a lot on slow or mobile networks. */
let rpcProvider: JsonRpcProvider | undefined;
function getRpcProvider(): JsonRpcProvider {
  if (!rpcProvider) {
    const url = process.env.NEXT_PUBLIC_RPC_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_RPC_URL is not set in the frontend environment — add it and redeploy.");
    }
    rpcProvider = new JsonRpcProvider(url, undefined, { usePathing: true });
  }
  return rpcProvider;
}

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
  return new Contract(
    requireAddress("NEXT_PUBLIC_PAYWITHQUAI_ADDRESS", PAYWITHQUAI_ADDRESS),
    paywithquaiAbi,
    signer,
  );
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

export async function registerOrderBatch(
  merchant: string,
  orderIds: string[],
  token: string,
  amount: bigint,
  expiry = 0n,
): Promise<string> {
  const signer = await getSigner();
  await assertMerchantSigner(signer, merchant);
  const tx = await getContract(signer).registerOrderBatch(orderIds, token, amount, expiry);
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
  const payAddress = requireAddress("NEXT_PUBLIC_PAYWITHQUAI_ADDRESS", PAYWITHQUAI_ADDRESS);
  const contract = getContract(signer);
  await (await new Contract(token, [
    "function approve(address spender, uint256 amount) returns (bool)",
  ], signer).approve(payAddress, amount)).wait();
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
  timeoutMs = 10_000,
): Promise<OrderStatus | null> {
  const res = await backendFetch(
    `/v1/orders/${merchant}/${orderId}`,
    { signal: AbortSignal.timeout(timeoutMs) },
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
  const contract = new Contract(
    requireAddress("NEXT_PUBLIC_PAYWITHQUAI_ADDRESS", PAYWITHQUAI_ADDRESS),
    paywithquaiAbi,
    getRpcProvider(),
  );
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
  const contract = new Contract(
    requireAddress("NEXT_PUBLIC_PAYWITHQUAI_ADDRESS", PAYWITHQUAI_ADDRESS),
    paywithquaiAbi,
    getRpcProvider(),
  );
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
    // Check backend and chain in parallel — a slow backend must never gate the chain read.
    const [order, settledChain] = await Promise.all([
      fetchOrderStatus(merchant, orderId, 4_000).catch(() => null),
      settledOnChain
        ? Promise.resolve(true)
        : isSettledOnChain(merchant, orderId).catch(() => false),
    ]);
    if (order) {
      onProgress?.(order.webhook?.status ?? null);
      if (order.settled && order.webhook?.status === "delivered") {
        return { backend: true, settledOnChain: true, webhookDelivered: true };
      }
      backendOk = true;
      if (order.settled) settledOnChain = true;
    }
    if (settledChain) settledOnChain = true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!settledOnChain) {
    settledOnChain = await isSettledOnChain(merchant, orderId).catch(() => false);
  }
  return { backend: backendOk, settledOnChain, webhookDelivered: false };
}

export { formatQuai, parseQuai };

export interface LinkInfo {
  slug: string;
  merchantAddress: string;
  merchantId: string;
  merchantName: string;
  shopName: string;
  tokenAddress: string;
  amount: string;
  amountDisplay: string;
  symbol: string;
  expiryDurationSecs: number;
  multiPay: boolean;
  poolSize: number;
  createdAt: number;
}

/** Fetch a short link's metadata (publicly accessible — no auth needed). */
export async function fetchLink(slug: string): Promise<LinkInfo | null> {
  const res = await backendFetch(`/v1/links/${slug}`, { signal: AbortSignal.timeout(10_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`backend error ${res.status}`);
  return (await res.json()) as LinkInfo;
}

export interface ClaimResult {
  orderId: string;
  merchant: string;
  token: string;
  amount: string;
  poolRemaining: number;
  /** Set when the server returned 429 — the retryAfterSecs until they can claim again. */
  retryAfterSecs?: number;
}

/**
 * Claim an orderId from a short link's pool.
 * - On success: returns the claimed orderId.
 * - On 429 (same wallet within 5 mins): returns the existing orderId from the response so the
 *   customer can still complete payment on their already-claimed order.
 * - On 503 (pool exhausted): throws with a user-friendly message.
 */
export async function claimOrderFromLink(slug: string, payerAddress: string): Promise<ClaimResult> {
  const res = await backendFetch(`/v1/links/${slug}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payerAddress }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 503) {
    throw new Error('Payment link is fully booked — the merchant needs to add more order slots. Please try again later.');
  }
  const body = (await res.json()) as ClaimResult & { error?: string; retryAfterSecs?: number };
  if (res.status === 429) {
    // Return the already-claimed orderId so they can continue their payment
    if (!body.orderId) throw new Error('You already used this link recently. Please wait a few minutes before trying again.');
    return { ...body, retryAfterSecs: body.retryAfterSecs };
  }
  if (!res.ok) throw new Error(body.error ?? `backend error ${res.status}`);
  return body;
}

/** Create a short link in the backend (requires merchant session cookie). */
export async function createPaymentLink(payload: {
  shopName?: string;
  tokenAddress: string;
  amount: string;
  amountDisplay: string;
  symbol: string;
  expiryDurationSecs: number;
  multiPay: boolean;
  orderPool: string[];
}): Promise<LinkInfo> {
  const res = await backendFetch('/v1/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `backend error ${res.status}`);
  }
  return (await res.json()) as LinkInfo;
}

/** Fetch all links for the currently-authenticated merchant. */
export async function fetchMyLinks(): Promise<LinkInfo[]> {
  const res = await backendFetch('/v1/links', { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`backend error ${res.status}`);
  const body = (await res.json()) as { links: LinkInfo[] };
  return body.links;
}

/**
 * Poll until the order is confirmed ON-CHAIN only — does NOT wait for the webhook.
 * Shows the success screen immediately after the tx settles.
 */
export async function waitForOnChainConfirmation(
  merchant: string,
  orderId: string,
  onProgress?: (status: string) => void,
  maxSeconds = 90,
): Promise<boolean> {
  const deadline = Date.now() + maxSeconds * 1000;
  onProgress?.('Waiting for block confirmation…');
  while (Date.now() < deadline) {
    // Chain + backend in parallel; backend gets a short timeout so a slow or sleeping relayer
    // never delays the fast on-chain confirmation.
    const [settledChain, order] = await Promise.all([
      isSettledOnChain(merchant, orderId).catch(() => false),
      fetchOrderStatus(merchant, orderId, 4_000).catch(() => null),
    ]);
    if (settledChain || order?.settled) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}