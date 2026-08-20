import { getZoneForAddress } from "quais";

export type WalletBrand =
  | "pelagus"
  | "blip"
  | "metamask"
  | "rabby"
  | "coinbase"
  | "brave"
  | "okx"
  | "bitget"
  | "trust"
  | "frame"
  | "generic";

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

export interface DetectedWallet {
  id: string;
  name: string;
  brand: WalletBrand;
  provider: Eip1193Provider;
  /** True only when the wallet can actually talk to the Quai network. Quai uses its own
   *  `quai_requestAccounts` / quai-chain RPC; only Blip (window.quai), Pelagus (window.pelagus)
   *  and MetaMask (which accepts custom networks via wallet_addEthereumChain) qualify. Other EVM
   *  wallets are listed for honesty but must never be presented as Quai-ready. */
  supportsQuai: boolean;
}

export const QUAI_ORCHARD_CHAIN = {
  chainId: "0x3A98", // 15000 — Orchard testnet (Pelagus)
  chainName: "Quai Network Orchard",
  nativeCurrency: { name: "Quai", symbol: "QUAI", decimals: 18 },
  rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL ?? "https://orchard.rpc.quai.network"],
  blockExplorerUrls: ["https://orchard.quaiscan.io"],
};

export const QUAI_MAINNET_CHAIN = {
  chainId: "0x9", // 9 — Quai mainnet, Cyprus-1 zone (Blip)
  chainName: "Quai Network (Mainnet)",
  nativeCurrency: { name: "Quai", symbol: "QUAI", decimals: 18 },
  rpcUrls: [
    process.env.NEXT_PUBLIC_RPC_MAINNET_URL ?? "https://rpc.quai.network/cyprus1",
  ],
  blockExplorerUrls: ["https://quaiscan.io"],
};

export type ChainConfig = typeof QUAI_ORCHARD_CHAIN;

/** Blip lives on Quai mainnet; every other wallet targets the Orchard testnet. */
export function chainForWallet(brand: WalletBrand | undefined): ChainConfig {
  return brand === "blip" ? QUAI_MAINNET_CHAIN : QUAI_ORCHARD_CHAIN;
}

const STORAGE_KEY = "quaimerchant:active-wallet";

interface UnknownProvider {
  /** Blip's provider flags (window.quai in its in-app browser). */
  isBlip?: boolean;
  _isSwiftBlip?: boolean;
  /** Pelagus desktop extension. Blip ALSO sets isPelagus:true for compat — so isPelagus
   *  must never be treated as "Blip" or win over the Blip flags. */
  isPelagus?: boolean;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isCoinbaseExtension?: boolean;
  isBraveWallet?: boolean;
  isOkxWallet?: boolean;
  isBitKeep?: boolean;
  isBitgetWallet?: boolean;
  isTrust?: boolean;
  isFrame?: boolean;
  uuid?: string;
}

declare global {
  interface Window {
    pelagus?: Eip1193Provider;
    /** Blip wallet injects window.quai inside its in-app browser (flagged isBlip/_isSwiftBlip).
     *  Pelagus may also expose window.quai for backwards compatibility — without Blip flags. */
    quai?: Eip1193Provider & { isBlip?: boolean; _isSwiftBlip?: boolean };
    ethereum?: Eip1193Provider & { providers?: Eip1193Provider[] };
  }
}

function identify(
  provider: Eip1193Provider,
  fromPelagusSlot: boolean,
): { name: string; brand: WalletBrand } {
  const p = provider as UnknownProvider;
  // Blip first — its provider sets isPelagus:true for Pelagus compatibility, so
  // the Blip flags must always win over isPelagus.
  if (p.isBlip || p._isSwiftBlip) return { name: "Blip Wallet", brand: "blip" };
  // Pelagus — either the window.pelagus slot, or a Pelagus provider exposed on
  // window.quai for backwards compatibility (no Blip flags).
  if (fromPelagusSlot || p.isPelagus) return { name: "Pelagus", brand: "pelagus" };
  if (p.isRabby) return { name: "Rabby", brand: "rabby" };
  if (p.isCoinbaseWallet || p.isCoinbaseExtension)
    return { name: "Coinbase Wallet", brand: "coinbase" };
  if (p.isBraveWallet) return { name: "Brave Wallet", brand: "brave" };
  if (p.isOkxWallet) return { name: "OKX Wallet", brand: "okx" };
  if (p.isBitKeep || p.isBitgetWallet)
    return { name: "Bitget Wallet", brand: "bitget" };
  if (p.isTrust) return { name: "Trust Wallet", brand: "trust" };
  if (p.isFrame) return { name: "Frame", brand: "frame" };
  if (p.isMetaMask) return { name: "MetaMask", brand: "metamask" };
  return { name: "Browser wallet", brand: "generic" };
}

/** The only wallets that can sign for the Quai network (see DetectedWallet.supportsQuai). */
const QUAI_CAPABLE_BRANDS: ReadonlySet<WalletBrand> = new Set<WalletBrand>([
  "blip",
  "pelagus",
  "metamask",
]);

function providerId(provider: Eip1193Provider): string {
  const uuid = (provider as UnknownProvider).uuid;
  if (uuid) return uuid;
  const name = (provider as { constructor?: { name?: string } }).constructor?.name;
  return name ?? "provider";
}

export function detectWallets(): DetectedWallet[] {
  if (typeof window === "undefined") return [];
  const seen = new Set<string>();
  const wallets: DetectedWallet[] = [];

  const push = (
    provider: Eip1193Provider | undefined,
    fromPelagusSlot: boolean,
  ) => {
    if (!provider) return;
    const key = providerId(provider);
    if (seen.has(key)) return;
    seen.add(key);
    const { name, brand } = identify(provider, fromPelagusSlot);
    wallets.push({
      id: `${brand}:${key}`,
      name,
      brand,
      provider,
      supportsQuai: QUAI_CAPABLE_BRANDS.has(brand),
    });
  };

  // Blip wallet injects window.quai (flagged isBlip/_isSwiftBlip) — detect it first.
  // Pelagus may expose window.quai too (backwards compat) — without Blip flags it
  // falls through to identify(), which maps isPelagus → brand "pelagus".
  if (window.quai) {
    const p = window.quai;
    if (p.isBlip || p._isSwiftBlip) {
      const key = providerId(window.quai);
      seen.add(key);
      wallets.push({
        id: "blip:quai",
        name: "Blip Wallet",
        brand: "blip",
        provider: window.quai,
        supportsQuai: true,
      });
      // Blip aliases the same provider into window.pelagus / window.ethereum —
      // dedupe those slots so Blip isn't listed twice (as Pelagus / generic).
      for (const alias of [window.pelagus, window.ethereum]) {
        if (alias) seen.add(providerId(alias));
      }
    } else {
      push(window.quai, false);
    }
  }

  // Pelagus has first-class slot
  push(window.pelagus, true);

  push(window.ethereum, false);

  const multi = window.ethereum?.providers ?? [];
  for (const provider of multi) push(provider, false);

  return wallets;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getStoredWalletId(): string | null {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeWalletId(id: string | null): void {
  if (!isBrowser()) return;
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable — ignore
  }
}

export function getActiveWallet(): DetectedWallet | null {
  const stored = getStoredWalletId();
  if (!stored) return null;
  return detectWallets().find((w) => w.id === stored) ?? null;
}

/** Asks the wallet for its current chain id (hex). */
export async function getWalletChainId(
  provider: Eip1193Provider,
): Promise<string | null> {
  try {
    const chainId = (await provider.request({
      method: "eth_chainId",
    })) as string;
    return chainId ?? null;
  } catch {
    return null;
  }
}

/**
 * Puts the wallet on the chain it operates on — Blip is a mainnet wallet,
 * Pelagus and other wallets target the Orchard testnet.
 * Switches when the chain is already known, otherwise asks the wallet to add it.
 * The outcome is verified by re-reading the wallet's chain id — wallets may resolve
 * the switch promise without actually changing, or reject it with non-standard codes.
 */
export async function ensureQuaiNetwork(
  provider: Eip1193Provider,
  target: ChainConfig = chainForWallet(getActiveWallet()?.brand),
): Promise<"ok" | "unsupported"> {
  const targetId = target.chainId.toLowerCase();
  const current = await getWalletChainId(provider);
  if (current && current.toLowerCase() === targetId) return "ok";

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: target.chainId }],
    });
    const after = await getWalletChainId(provider);
    if (after && after.toLowerCase() === targetId) return "ok";
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4001) throw new Error("Network switch declined.");
  }

  // Switch failed or didn't take effect — some wallets reject unknown chains with
  // codes other than 4902, so try adding the chain regardless of the error.
  try {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [target],
    });
    const after = await getWalletChainId(provider);
    if (after && after.toLowerCase() === targetId) return "ok";
  } catch {
    // fall through — wallet can't reach the target chain
  }
  return "unsupported";
}

/**
 * Connects to the chosen wallet and returns the active address.
 * Uses `quai_requestAccounts` (Blip/Pelagus) with `eth_requestAccounts` (MetaMask) fallback.
 * Validates that the account lives in the Cyprus-1 zone (0x00…).
 */
export async function connectWallet(
  wallet: DetectedWallet,
): Promise<string> {
  let accounts: string[] = [];
  try {
    accounts = (await wallet.provider.request({
      method: "quai_requestAccounts",
    })) as string[];
  } catch {
    accounts = (await wallet.provider.request({
      method: "eth_requestAccounts",
    })) as string[];
  }
  if (!accounts?.length) {
    throw new Error(`${wallet.name} returned no accounts — unlock it first.`);
  }
  const address = accounts[0];
  const zone = getZoneForAddress(address);
  if (zone !== "0x00") {
    throw new Error(
      `Account is in zone ${zone} — switch to a Cyprus-1 (0x00…) account in ${wallet.name}.`,
    );
  }
  return address;
}