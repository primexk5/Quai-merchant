import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseError(err: unknown): string {
  const e = (typeof err === "object" && err !== null ? err : {}) as Record<string, unknown>;
  const nested = (typeof e.error === "object" && e.error !== null ? e.error : undefined) as
    | Record<string, unknown>
    | undefined;
  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : typeof e.message === "string"
          ? e.message
          : "";

  // quais/ethers v6 wraps rich errors: shortMessage (human text), reason (revert string),
  // code (machine type). Dig them out before falling back to the raw message.
  const shortMessage = typeof e.shortMessage === "string" ? e.shortMessage : "";
  const reason =
    typeof e.reason === "string" ? e.reason : typeof nested?.reason === "string" ? nested.reason : "";
  const nestedMessage =
    typeof nested?.message === "string"
      ? nested.message
      : typeof nested?.data === "object" && nested.data !== null &&
          typeof (nested.data as { message?: unknown }).message === "string"
        ? (nested.data as { message: string }).message
        : "";
  const code = typeof e.code === "string" ? e.code : "";

  const message = reason || shortMessage || nestedMessage || raw;
  const lowerMsg = message.toLowerCase();

  if (
    lowerMsg.includes("user rejected") ||
    lowerMsg.includes("quais-user-denied") ||
    lowerMsg.includes("action_rejected") ||
    code === "ACTION_REJECTED"
  ) {
    return "User rejected the request in the wallet.";
  }
  if (
    code === "INSUFFICIENT_FUNDS" ||
    lowerMsg.includes("insufficient funds") ||
    lowerMsg.includes("insufficient_funds")
  ) {
    return "Insufficient funds to complete this transaction.";
  }
  if (lowerMsg.includes("transaction underpriced") || code === "REPLACEMENT_UNDERPRICED") {
    return "Transaction underpriced. Please try with a higher gas price.";
  }
  if (lowerMsg.includes("nonce too low") || code === "NONCE_EXPIRED") {
    return "Transaction nonce too low. Please reset your wallet or try again.";
  }
  if (code === "UNPREDICTABLE_GAS_LIMIT" || lowerMsg.includes("unpredictable gas limit")) {
    return "Could not estimate gas — the order may be expired or already settled.";
  }
  if (code === "CALL_EXCEPTION" || lowerMsg.includes("execution reverted") || lowerMsg.includes("reverted")) {
    const why = reason || shortMessage;
    return why ? `Transaction reverted: ${why}` : "Transaction reverted by the contract.";
  }
  if (
    code === "SERVER_ERROR" ||
    code === "TIMEOUT" ||
    lowerMsg.includes("network_error") ||
    lowerMsg.includes("disconnected") ||
    lowerMsg.includes("timed out")
  ) {
    return "Network error. Please check your connection to the network.";
  }

  // Long RPC/JSON blobs with no recognizable cause — keep it short instead of dumping raw JSON.
  if (message.length > 200) {
    return "Transaction failed due to an unknown error. Please try again.";
  }

  return message || "An unknown error occurred.";
}