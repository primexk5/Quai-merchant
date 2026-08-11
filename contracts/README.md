# Pay with Quai — Smart Contracts

The on-chain component of the **Pay with Quai** merchant checkout system (docs 4). A, 
non-custodial payment router: a merchant registers an order, the customer settles it in one
transaction, and the contract verifies the amount, withholds an optional platform fee,
forwards funds to the merchant, and emits a `PaymentReceived` event for the off-chain relayer.

Funds never rest in the contract — every payment is routed through and out in the same
transaction, keeping the attack surface minimal.

## Contracts

| Contract | Purpose |
| --- | --- |
| `PayWithQuai.sol` | Payment router: `registerOrder` / `cancelOrder`, `payOrder` (ERC-20), `payOrderNative` (QUAI), token allowlist + fee + pause admin, `rescueTokens` sweep, two-step ownership. |
| `MockStablecoin.sol` | 6-decimal test ERC-20 (`mUSDQ`) with an open `mint` faucet — testing/testnet only. |
| `mocks/Reentrant*.sol` | Test-only attackers proving the reentrancy guard holds. |

### Payment flow

```
owner.setTokenAccepted(token, true)                    // once, per settlement asset (address(0) = native QUAI)
merchant.registerOrder(orderId, token, amount, expiry) // once, per order (expiry 0 = never); locks in the current fee
customer.approve(PayWithQuai, amount)                  // ERC-20 only
customer.payOrder(merchant, orderId)                   // or payOrderNative{value: amount}(merchant, orderId)
        └─► verify amount ─► split fee ─► pay merchant ─► mark settled ─► emit PaymentReceived
```

Orders are keyed by `(merchant, orderId)`, and only the merchant can register (or cancel) its
own orders, so a third party cannot front-run or hijack an order id. A settled order can never
be paid twice (`OrderAlreadySettled`); an unpaid order can be `cancelOrder`ed to free its id, or
left to lapse if it was given an `expiry`. The platform fee is **locked at registration** — a
later `setFeeConfig` only affects orders registered after it, so a merchant's net proceeds are
fixed the moment they register. Anyone may *submit* the payment (the `payer` need not be the
buyer you expect); settlement is validated by amount + order state, not by payer identity.

### The event the relayer listens for (docs §4.3)

```solidity
event PaymentReceived(
    address indexed merchant,
    bytes32 indexed orderId,
    address payer,
    address token,       // settlement asset (address(0) = native QUAI)
    uint256 amount,      // gross amount the payer sent; merchant nets amount - fee
    uint256 timestamp
);
```

`merchant` and `orderId` are indexed so the relayer can filter efficiently per merchant. `token`
is included so the relayer can act on the event without a follow-up read. The string `merchantId`
from the webhook payload (§5.2) is an off-chain mapping from this address.

> **Wait for finality before confirming.** `PaymentReceived` can be emitted in a block that later
> reorgs. The relayer should wait for N confirmations (and optionally re-check `isSettled` on-chain)
> before POSTing `payment.confirmed` to the merchant — otherwise a reorg produces a false "paid".

## Quickstart

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test        # full suite on the in-process EVM — no node or funds needed
```

## Deploy to Quai testnet

```bash
cp .env.dist .env       # fill in CYPRUS1_PK (fund it from the Quai faucet); Orchard RPC is preset
npm run deploy:testnet  # deploys MockStablecoin + PayWithQuai, writes deployments/cyprus1.json
npm run demo:testnet    # runs the full register → approve → pay → event loop on-chain
```

- Solidity **0.8.20**, `evmVersion: london` (Quai EVM supports ≤ 0.8.20).
- The deploy script allowlists native QUAI + the mock stablecoin automatically. On mainnet,
  set `STABLECOIN_ADDR` in `.env` to allowlist a real stablecoin (or call `setTokenAccepted` later).
- Deploys use the **quais** SDK (Hardhat's ethers cannot talk to Quai). The `ContractFactory`
  takes an IPFS metadata CID (via `@quai/hardhat-deploy-metadata`) so Quaiscan can verify source.
- Networks: Orchard testnet (`CHAIN_ID=15000`, `https://orchard.rpc.quai.network`), mainnet
  (`CHAIN_ID=9`, `https://rpc.quai.network`).

## Notes & roadmap

- **Quai is sharded — keep everyone in one zone.** Value moves within a single zone, so the
  contract, the merchant payout wallet, and `feeRecipient` must all live in the same zone as the
  deployment (e.g. all Cyprus-1, address prefix `0x00`). A plain transfer cannot pay an address in
  another zone. Enforce this in the backend before registering an order.
- **The fee is locked at registration.** The customer pays the registered `amount`; the merchant
  nets `amount − fee` using the fee that was in effect *when the order was registered*. A later
  `setFeeConfig` only changes orders registered afterwards. `PaymentReceived.amount` is the gross
  figure.
- **`feeRecipient` must be transfer-safe.** On the native path the fee is sent via a plain `.call`,
  so a `feeRecipient` that reverts on receiving value would block every native payment. Keep it an
  EOA or a known payable-safe contract.
- **Stray funds are recoverable.** The router never holds funds during normal operation, but a
  stray ERC-20 `transfer` (or QUAI force-sent via `selfdestruct`) can land on it. The owner can
  `rescueTokens(token, to, amount)` to recover them (`token = address(0)` sweeps native QUAI).
- **Move ownership to a multisig.** The owner can pause payments and set the fee (≤ 5%); don't
  leave a hot EOA as owner in production. Ownership transfer is two-step (`Ownable2Step`).
- **Payout wallet** currently equals the registering wallet. A v2 merchant registry can
  separate a hot "controller" key from a cold payout address.
- **Escrow / refunds / split payments** are the doc's stretch (v2) features — this router is
  the recommended hackathon core.
- Native orders require an **exact** `msg.value` — correct for a fixed on-chain price. Any
  fiat→token slippage is resolved off-chain at quote time, before the amount is registered.
- Assumes standard (non-fee-on-transfer, non-rebasing) ERC-20 stablecoins. With a fee-on-transfer
  token the merchant would receive less than `amount − fee` while the event still reports the gross
  `amount`, so the relayer would confirm an under-delivered payment. **The token allowlist is the
  mitigation** — only allowlist vetted, well-behaved tokens.
