import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseError(err: unknown): string {
  const message =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "";

  const lowerMsg = message.toLowerCase();

  if (
    lowerMsg.includes("user rejected") ||
    lowerMsg.includes("quais-user-denied") ||
    lowerMsg.includes("action_rejected")
  ) {
    return "User rejected the request in the wallet.";
  }
  if (
    lowerMsg.includes("insufficient funds") ||
    lowerMsg.includes("insufficient_funds")
  ) {
    return "Insufficient funds to complete this transaction.";
  }
  if (lowerMsg.includes("transaction underpriced")) {
    return "Transaction underpriced. Please try with a higher gas price.";
  }
  if (lowerMsg.includes("nonce too low")) {
    return "Transaction nonce too low. Please reset your wallet or try again.";
  }
  if (
    lowerMsg.includes("network_error") ||
    lowerMsg.includes("disconnected")
  ) {
    return "Network error. Please check your connection to the network.";
  }

  // If it's a huge JSON blob or long string without matching our known reasons, 
  // just return a generic failure
  if (message.length > 200) {
    return "Transaction failed due to an unknown error. Please try again.";
  }

  return message || "An unknown error occurred.";
}