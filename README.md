# Countwerk Client (Node.js)

Thin Node.js/TypeScript client for Countwerk consumer APIs.

## Install

```bash
npm i @sebastianmaierofficial/countwerk-client
```

## Quickstart

```ts
import { createCountwerkClient, CountwerkError } from "@sebastianmaierofficial/countwerk-client";

const countwerk = createCountwerkClient({
  baseUrl: "https://<your-countwerk-host>",
  apiKey: "cs_...your_key..."
});

async function demo() {
  // Resolve order
  const resolved = await countwerk.resolveOrder("ORDER_123");

  // Deduct credits (idempotent)
  await countwerk.deduct({
    account_id: resolved.account_id,
    operation: "app.chat.reply",
    amount: 1,
    usage_event_id: "turn-2026-01-20-001",
    description: "Chat reply"
  });

  // Purchase links
  const links = await countwerk.purchaseLinks({
    ai_product_id: "ai_product_001",
    account_id: resolved.account_id,
    current_tier_product_id: "PRO_001",
    current_order_id: "ORDER_123"
  });

  return links.options;
}

async function run() {
  try {
    await demo();
  } catch (err) {
    if (err instanceof CountwerkError) {
      console.error(err.code, err.status, err.details);
    }
    throw err;
  }
}

run();
```

## API

```ts
createCountwerkClient({
  baseUrl: string,
  apiKey: string,
  timeoutMs?: number,
  maxRetries?: number
})
```

Client methods:
- `resolveOrder(order_id)`
- `purchaseLinks({ ai_product_id, account_id, current_order_id?, current_tier_product_id?, buyer_email? })`
- `balance(account_id)`
- `deduct({ account_id, amount, operation, usage_event_id, description?, metadata? })`
- `reserve({ account_id, amount, operation, validityMinutes?, description? })`
- `confirmReservation({ reservationId, actualAmount?, description? })`
- `cancelReservation({ reservationId, reason? })`

## Error handling

The client throws `CountwerkError` for non-2xx responses or `success: false` payloads.

Fields:
- `code`: string (e.g. `INSUFFICIENT_CREDITS`, `ORDER_NOT_FOUND`)
- `status`: number (HTTP status)
- `message`: string
- `details?`: response `data` if present

## Security

**Never use your API key in the browser.** Only call Countwerk from a trusted server.

## Links

- https://countware.com
