import type { Merchant, Session, WebhookDelivery } from '../types.js';

/**
 * Persistence boundary for the relayer. The default implementation ({@link JsonStore}) is a
 * dependency-free, atomically-written JSON file — fine for a single-process relayer. Swap in a
 * SQLite/Postgres implementation of this same interface for higher throughput or HA without
 * touching the indexer / dispatcher / API.
 */
export interface Store {
  // --- indexer cursor (last fully-processed block, scoped to this contract+chain) ---
  /** Cursor is keyed by a `scope` string (e.g. `${chainId}:${contractAddress}`) so a store file
   *  reused across a different chain or contract address can never silently skip events. */
  getCursor(scope: string): number | undefined;
  setCursor(scope: string, blockNumber: number): void;

  // --- merchants (keyed by lowercased on-chain address) ---
  upsertMerchant(m: Merchant): void;
  getMerchantByAddress(address: string): Merchant | undefined;
  getMerchantById(merchantId: string): Merchant | undefined;
  listMerchants(): Merchant[];

  // --- webhook deliveries (id == paymentId; also the payment idempotency key) ---
  /** Insert a delivery only if its id is new. Returns true if inserted, false if it already existed. */
  insertDeliveryIfAbsent(d: WebhookDelivery): boolean;
  getDelivery(id: string): WebhookDelivery | undefined;
  updateDelivery(d: WebhookDelivery): void;
  /** Persist a delivery transition only if the stored record still matches `guard` (the snapshot
   *  the caller read when it started) — i.e. nothing — an admin retry, a requeue, another sweep —
   *  touched the record while the caller was busy. Returns true when written, false when the CAS
   *  failed and the update was discarded. */
  updateDeliveryIfCurrent(d: WebhookDelivery, guard: Pick<WebhookDelivery, 'attempts' | 'status' | 'nextAttemptAt' | 'updatedAt'>): boolean;
  /** Delivery for a given (merchant, orderId), if any — the O(1) counterpart of scanning the list. */
  getDeliveryByOrder(merchant: string, orderId: string): WebhookDelivery | undefined;
  /** Re-queue `skipped` payments that belong to `m` (its address was just onboarded). Returns
   *  the number re-queued. Payments to unregistered addresses are not lost — they resume once
   *  the address is registered. */
  requeueSkippedForMerchant(m: Merchant): number;
  /** Deliveries in `pending` status whose nextAttemptAt <= now, oldest first. */
  getDueDeliveries(now: number, limit: number): WebhookDelivery[];
  listDeliveries(limit: number): WebhookDelivery[];

  // --- auth sessions (opaque bearer tokens, persisted across restarts) ---
  createSession(s: Session): void;
  getSession(token: string): Session | undefined;
  deleteSession(token: string): void;

  // --- login challenges (single-use nonces bound to an address + expiry) ---
  createNonce(nonce: string, address: string, expiresAt: number): void;
  /** Consume a nonce exactly once. Returns the address it was issued for, or undefined if the
   *  nonce is unknown, expired or already used — any of which must fail the login. */
  consumeNonce(nonce: string): string | undefined;

  close(): void;
}
