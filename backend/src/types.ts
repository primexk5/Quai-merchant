/**
 * Shared domain types for the relayer.
 *
 * On-chain amounts are the token's smallest unit and can exceed 2^53, so they are carried as
 * `bigint` internally and serialized to decimal strings at the JSON boundary (webhooks / API).
 */

/** The native-QUAI sentinel used by PayWithQuai (`token == address(0)`). */
export const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';

/** A decoded `PaymentReceived` event, enriched with block/finality metadata. */
export interface PaymentEvent {
  merchant: string; // on-chain payout address (checksummed)
  orderId: string; // bytes32 hex
  payer: string;
  token: string; // ERC-20 address, or NATIVE_TOKEN for native QUAI
  amount: bigint; // gross amount, smallest unit
  eventTimestamp: number; // unix seconds from the contract event
  blockNumber: number;
  txHash: string;
  logIndex: number;
}

/** Stable idempotency key for a settlement: one payment == one (txHash, logIndex). */
export function paymentId(e: Pick<PaymentEvent, 'txHash' | 'logIndex'>): string {
  return `${e.txHash.toLowerCase()}:${e.logIndex}`;
}

export interface Merchant {
  merchantId: string; // platform id, e.g. "mch_ab12..."
  address: string; // lowercased on-chain payout address (the map key)
  name: string;
  webhookUrl: string;
  webhookSecret: string; // used to HMAC-sign deliveries to this merchant
  active: boolean;
  createdAt: number;
}

/** An opaque bearer-token session issued after a wallet-signature login. */
export interface Session {
  token: string; // random opaque token, the only thing the client stores
  merchantId: string;
  address: string; // lowercased merchant address the session belongs to
  createdAt: number; // unix ms
  expiresAt: number; // unix ms — past this, the session is invalid
}

export type WebhookEventType = 'payment.confirmed';

/** The JSON body POSTed to a merchant's webhook endpoint. */
export interface WebhookPayload {
  id: string; // delivery/event id, unique per payment
  type: WebhookEventType;
  created: number; // unix seconds the event was emitted by the relayer
  data: {
    merchantId: string;
    merchant: string; // on-chain address
    orderId: string; // bytes32 hex
    payer: string;
    token: string; // NATIVE_TOKEN for native QUAI
    amount: string; // gross amount the payer sent, smallest unit, decimal string
    feeBps: number; // platform fee rate locked at order registration (basis points)
    fee: string; // platform fee withheld = floor(amount * feeBps / 10000), smallest unit, decimal string
    net: string; // amount - fee, what the merchant actually received, smallest unit, decimal string
    txHash: string;
    blockNumber: number;
    timestamp: number; // on-chain event timestamp
    nonce: number; // per-merchant order nonce; distinguishes order-id reuse after a purge
  };
}

export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'skipped';

export interface WebhookDelivery {
  id: string; // == paymentId
  merchantId: string;
  url: string;
  payload: WebhookPayload;
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: number; // unix ms; when this delivery becomes eligible again
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}
