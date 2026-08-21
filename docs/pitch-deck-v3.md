# QUAI Merchant — Pitch Deck (v3)

Supersedes `pitch-deck-script.md` (v2). Built from the current product: live on the Quai Orchard testnet, native Blip integration, payment links, and social commerce.

Creative direction: **"Payments in Africa are broken. The fast lane was already built. We built the storefront."**

Length: ~8 minutes, 12 slides.

---

## Slide 1 — Cover

**On-screen headline:** Payments built for the speed of Quai.

**On-screen copy:**
- QUAI MERCHANT
- The checkout layer for the Quai network
- Non-custodial. No KYC. No waiting.

**Visual:** Checkout mock — "25.00 QUAI", "Pay with Quai" button, green checkmark.

**What you say (20s):**
"Payments should just work. That's the whole company. QUAI Merchant is a checkout layer for the Quai blockchain — any merchant accepts crypto payments with a button their customers already know how to use. My name is [Name], and I'm the [role]."

---

## Slide 2 — The problem

**On-screen headline:** Payments in Africa are broken.

**On-screen copy (six cards, one line each):**
- **T+1 to T+3 days** — Paystack, Flutterwave: you made the sale, you can't touch the money
- **1.5–2% per transaction** — fees eat straight into margins
- **Weeks of KYC** — BVN checks, CAC filings, endless uploads
- **Custodial risk** — freezes, withdrawal limits, arbitrary holds
- **Cross-border friction** — blocked cards, FX markups, failed transfers
- **Excludes millions** — no website, no developer, no checkout

**Visual:** Six cards, one big number each. Nothing else.

**What you say (35s):**
"Meet Ada. She runs a clothing store in Lagos, sells on WhatsApp. She made a sale this morning — she'll see the money tomorrow, maybe Monday. Meanwhile every sale paid a 2% toll, and she couldn't get a payment provider anyway without a business registration and a website. Digital commerce runs at internet speed. Money for African merchants runs at 1980s bank speed."

---

## Slide 3 — The fast lane already exists

**On-screen headline:** Nobody built the storefront.

**On-screen copy (three numbers):**
- **<$0.01** per transaction
- **255K+** transactions per second
- **Seconds** to settlement

**Visual:** Three numbers. One line underneath: "Quai is open, programmable, EVM-compatible. But a merchant can't plug into it."

**What you say (30s):**
"The fast lane already exists. Quai settles in seconds, costs fractions of a cent, and scales to 255,000 transactions per second. It's EVM, so the tooling is familiar. What's missing was never the rail — it's the storefront: a way for a merchant to plug in and take payments. That's what we built."

---

## Slide 4 — Solution: the storefront

**On-screen headline:** Paystack's ease. Quai's speed.

**On-screen copy:**
- A checkout your customers already understand — wallet, amount, confirm
- Payment links: one shareable URL via WhatsApp, email, or social
- QR payments for physical commerce
- Signed webhooks — the merchant's system is told when it's PAID

**Visual:** Split screen — payment link card on the left, checkout UI on the right.

**What you say (30s):**
"QUAI Merchant is a familiar checkout with a Quai-powered backend. Merchants create a payment link or a QR code in seconds — no website, no developer, no approval process. The blockchain stays invisible. The merchant's system gets a cryptographically signed webhook the moment the payment is verified."

---

## Slide 5 — Live today

**On-screen headline:** Not a demo. A deployed product on Quai Orchard.

**On-screen copy:**
- **PayWithQuai contract** live on-chain (chain 15000) — funds routed straight to the merchant's wallet in one transaction, never held
- **Relayer** — confirms finality, re-checks settlement, delivers HMAC-signed `payment.confirmed` webhooks at-least-once with retries
- **Merchant dashboard** — payments, analytics, delivery history, settings
- **Wallet-signature login** — no passwords, no custody
- **Platform fee: 0.3%** — we get paid only when the merchant gets paid

**Visual:** Screenshot of the dashboard.

**What you say (35s):**
"Everything you're seeing is live on the Quai Orchard testnet. The PayWithQuai contract routes each payment straight from customer to merchant in a single transaction — funds never rest in the contract. A relayer watches finality and posts signed webhooks the merchant can verify. Merchants log in by signing a message with their wallet — no password, no KYC. The platform fee is 0.3%, only on successful payments."

---

## Slide 6 — Blip: one-tap mobile payments

**On-screen headline:** Your customers pay from their phone.

**On-screen copy:**
- **Blip** — the premier self-custody Quai wallet on iOS & Android
- Scan the QR or tap the link → the Blip app opens with the payment pre-filled
- Our checkout is detected automatically in Blip's in-app browser — one tap to confirm
- No app switching, no addresses to paste

**Visual:** Three-step flow — checkout → Blip opens → one tap to confirm.

**What you say (30s):**
"Mobile is where African commerce happens. We integrate natively with Blip, the self-custody Quai wallet for iOS and Android. A customer scans a QR or taps a link and the Blip app opens with the payment pre-filled. Our pages auto-detect the Blip browser and connect in one tap. The payment is done in seconds."

---

## Slide 7 — Social commerce

**On-screen headline:** Not just merchants with websites. Every seller, everywhere.

**On-screen copy:**
- **Facebook Marketplace** — payment link in the listing
- **WhatsApp & Telegram** — send the link in chat, get paid instantly
- **Twitter / X & Instagram** — link in bio or DMs
- **Local vendors** — physical market: share a link or QR, no POS terminal

**Visual:** A chat mock — "Here's your payment link" → 25.00 QUAI → "Payment confirmed. Order dispatched."

**What you say (30s):**
"Millions of sellers on WhatsApp, Instagram, and market stalls can't accept card payments at all. With QUAI Merchant, a seller shares a link in chat, the buyer taps and pays, and the seller sees 'Payment confirmed' instantly — every order tracked, tagged, and never mixed up. No app install for the buyer, no signup wall."

---

## Slide 8 — The 10-second loop

**On-screen headline:** Pay → Verified → PAID. End to end.

**On-screen copy (the flow):**
1. Merchant shares a payment link or QR
2. Customer connects wallet (Blip or browser extension) and pays
3. Quai verifies the order on-chain in seconds
4. Relayer confirms finality and posts a signed webhook
5. Merchant's system marks the order PAID

**Visual:** A loop of the five steps.

**What you say (30s):**
"The loop is short and complete. Customer pays, Quai verifies in the open, our relayer confirms finality with a re-check on-chain, and the merchant's system receives a signed webhook it can verify. Same feeling as clicking Pay on any website — except the truth is verifiable, in seconds, for less than a cent."

---

## Slide 9 — Competition

**On-screen headline:** We're not fighting for their lane. We're opening a new one.

**On-screen copy (compact table):**

| | Paystack | Flutterwave | QUAI Merchant |
|---|---|---|---|
| Settlement | T+1 | Next day | On-chain, seconds |
| Pricing | 1.5% + fixed | 2%* | 0.3% |
| KYC / onboarding | Weeks | Weeks | None — wallet signature |
| Custody | Custodial | Custodial | **Non-custodial** |
| Cross-border | Cards + rails | Cards + rails | Wallet / on-chain rail |
| Mobile-first sellers | No | No | **Yes (Blip + payment links)** |

\* Published Nigeria pricing. Competitors are mature and broader; our wedge is the Quai-native rail.

**What you say (30s):**
"We're not here to kill Paystack or Flutterwave. We're opening a lane they can't follow: payments that settle on-chain in seconds, non-custodial, no KYC, built for sellers without websites. Merchants who want card rails keep them. Merchants who want fast, cheap, verifiable settlement get us."

---

## Slide 10 — Business model & roadmap

**On-screen headline:** We get paid when merchants get paid.

**On-screen copy:**
- **Now:** 0.3% per successful payment — revenue scales with volume
- **Next:** paid analytics & reconciliation tiers
- **Then:** Shopify + WooCommerce plugins, subscriptions & recurring billing
- **Later:** direct bank off-ramp, mobile SDK

**Visual:** A staircase, four steps. Status chips: Merchant Analytics — In Progress; Shopify & off-ramp — Coming Soon.

**What you say (30s):**
"The model is simple: 0.3% on successful payments only — we earn when merchants earn. Then paid tools as they grow, then platform revenue: plugins, subscriptions, SDKs. Roadmap is deliberately boring: finish the core loop, ride into WooCommerce and Shopify, then off-ramps and mobile. Complexity only when the market proves it."

---

## Slide 11 — The ask

**On-screen headline:** What we need: three things.

**On-screen copy:**
1. **Ecosystem access** — connect with Quai builders, wallets, and teams to validate the flow
2. **Pilot merchants** — real Nigerian online and social sellers to test checkout + settlement
3. **Build resources** — to harden, secure, and scale the infrastructure

**Visual:** Three cards. Bottom line (big): "First proof point: a real merchant's payment link completes and the order automatically becomes PAID."

**What you say (30s):**
"Three things. One: access — get us in front of Quai's builders and wallets. Two: pilots — real merchants willing to try payment links and settlement. Three: resources to harden the loop. The proof point we're chasing is simple: a real merchant shares a link, a customer pays in Blip, and the order automatically becomes paid. That's the whole story."

---

## Slide 12 — Takeaway

**On-screen headline:** Payments should just work.

**On-screen copy:**
- Fast. Low-cost. Non-custodial. Merchant-ready.
- The checkout mock again — 25.00 QUAI, "Pay with Quai," ✓ PAID

**Visual:** Same as slide 1 — the bookend. The button is now checked.

**What you say (20s):**
"We opened with this and we'll close with it: payments should just work. QUAI Merchant makes the blockchain underneath powerful and the checkout on top familiar. Thank you — we'd love to show you the live demo on your phone with Blip."