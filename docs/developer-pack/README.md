# CountWerk Developer Pack (Start Here)

CountWerk is a credit + commerce layer for AI products.
It tracks balances, supports idempotent usage billing, and provides account-bound purchase links.
Integrations are server-to-server with an API key.

## Auth + Required Headers

All endpoints require:

- `X-API-Key: <YOUR_API_KEY>`
- `Content-Type: application/json`

Base URL (example):

- `https://<your-countwerk-host>`

## Required Identifiers

- `account_id`: Your external user/account identifier (stable).
- `ai_product_id`: The AI product you’re selling/serving.
- `order_id`: Digistore24 order id (used to resolve to `account_id`).
- `transaction_id`: Digistore24 transaction id (used when credits are added via DS24).

## SDK (optional, Node.js)

If you prefer a thin SDK instead of raw HTTP calls, you can use the official npm package.

Install:

```
npm i @sebastianmaierofficial/countwerk-client
```

Quick example:

```ts
import { createCountwerkClient } from "@sebastianmaierofficial/countwerk-client";

const countwerk = createCountwerkClient({
  apiKey: "cs_...your_key..."
  // baseUrl optional (defaults to https://app.countwerk.com)
});

await countwerk.resolveOrder("ORDER_123");
```

## The 3 Core Consumer Flows (MVP)

A) Claim / Link
- `resolve-order(order_id)` ➜ returns `account_id`

B) Runtime Usage
- `balance` (optional pre-check)
- `deduct` (idempotent via `usage_event_id`)
- handle `402 INSUFFICIENT_CREDITS`

C) Commerce
- `purchase-links` ➜ render `options[]`
- respect `enabled` / `disabledReason`
- never construct Digistore24 URLs manually

## No Fallbacks (Strict)

- DS24 key is required for purchase-links; missing/invalid keys may return a hard failure or a response with `options[]` disabled (do not degrade to raw URLs).
- `create_buy_url` is only for account-bound purchases. Never construct or cache DS24 URLs yourself.
- If required identifiers are missing, fail fast (no guessed identifiers).
- If `options[].enabled === false`, do not render as a valid purchase path.

## Error Handling (Quick Table)

| Code | Meaning | Consumer Behavior |
|------|---------|-------------------|
| `API_KEY_MISSING` / `INVALID_API_KEY` | Auth failed | Stop + fix credentials |
| `DS24_KEY_REQUIRED` | Missing DS24 key | Ask vendor to configure DS24 |
| `DS24_KEY_INVALID` | DS24 key invalid | Ask vendor to fix DS24 key |
| `INSUFFICIENT_CREDITS` (402) | Not enough credits | Offer purchase links |
| `ORDER_NOT_FOUND` | Unknown order | Ask user to retry or contact support |
| `ORDER_NOT_MAPPED_YET` | DS24 order not linked yet | Retry later (exponential backoff) |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Backoff + retry |
| `INVALID_INPUT` | Bad request | Fix payload |

## Quickstart (5 curl examples)

Set env vars:

```
BASE_URL=https://<your-countwerk-host>
API_KEY=cs_...your_key...
```

1) Resolve order ➜ account

```
curl -X POST "${BASE_URL}/api/credits/resolve-order" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"order_id":"ORDER_123"}'
```

2) Purchase links

```
curl -X POST "${BASE_URL}/api/purchase-links" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "ai_product_id":"ai_product_001",
    "account_id":"acct_123",
    "current_tier_product_id":"PRO_001",
    "current_order_id":"ORDER_123",
    "buyer_email":"buyer@example.com"
  }'
```

3) Balance

```
curl -X POST "${BASE_URL}/api/credits/balance" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"account_id":"acct_123"}'
```

4) Deduct (idempotent)

```
curl -X POST "${BASE_URL}/api/credits/deduct" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "account_id":"acct_123",
    "operation":"app.chat.reply",
    "amount":1,
    "usage_event_id":"turn-2026-01-20-001",
    "description":"Chat reply"
  }'
```

5) Confirm reservation (after reserve)

```
curl -X POST "${BASE_URL}/api/credits/confirm-reservation" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"reservationId":"RESERVATION_123","actualAmount":1}'
```

Next: `consumer-contract.md` for the full SSoT.
