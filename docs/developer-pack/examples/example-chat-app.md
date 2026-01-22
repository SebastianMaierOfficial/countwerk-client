# Example: Chat App (Short-Running Usage)

Goal: link an order to an account once, then deduct per chat turn.
No reservations.

## Flow

1) Resolve order to account_id (once).
2) Store account_id in your user profile.
3) For each chat turn:
   - (optional) check balance
   - deduct with a stable `usage_event_id`
   - on 402, show purchase links

## HTTP Examples

### 1) Resolve order

```
POST /api/credits/resolve-order
X-API-Key: <API_KEY>
Content-Type: application/json

{ "order_id": "ORDER_123" }
```

### 2) Deduct per turn (idempotent)

```
POST /api/credits/deduct
X-API-Key: <API_KEY>
Content-Type: application/json

{
  "account_id": "acct_123",
  "operation": "app.chat.reply",
  "amount": 1,
  "usage_event_id": "turn-2026-01-20-001",
  "description": "Chat reply"
}
```

### 3) Purchase links (on 402)

```
POST /api/purchase-links
X-API-Key: <API_KEY>
Content-Type: application/json

{
  "ai_product_id": "ai_product_001",
  "account_id": "acct_123"
}
```

## Pseudo-code

```
function handleChatTurn(userId, message) {
  const accountId = db.users.get(userId).account_id;
  const usageEventId = `turn-${message.id}`;

  try {
    countwerk.deduct({
      account_id: accountId,
      operation: "app.chat.reply",
      amount: 1,
      usage_event_id: usageEventId
    });

    return runModel(message);
  } catch (err) {
    if (err.code === "INSUFFICIENT_CREDITS") {
      const links = countwerk.purchaseLinks({
        ai_product_id: "ai_product_001",
        account_id: accountId
      });
      return renderUpsell(links.options);
    }
    throw err;
  }
}
```

## SDK Example (Node.js, optional)

```ts
import { createCountwerkClient } from "@sebastianmaierofficial/countwerk-client";

const countwerk = createCountwerkClient({ apiKey: "cs_...your_key..." });

async function handleChatTurn(userId, message) {
  const accountId = db.users.get(userId).account_id;
  const usageEventId = `turn-${message.id}`;

  try {
    await countwerk.deduct({
      account_id: accountId,
      operation: "app.chat.reply",
      amount: 1,
      usage_event_id: usageEventId
    });

    return runModel(message);
  } catch (err) {
    if (err.code === "INSUFFICIENT_CREDITS") {
      const links = await countwerk.purchaseLinks({
        ai_product_id: "ai_product_001",
        account_id: accountId
      });
      return renderUpsell(links.options);
    }
    throw err;
  }
}
```

## Expected Failure Cases

- `ORDER_NOT_MAPPED_YET`: retry resolve-order later.
- `INSUFFICIENT_CREDITS`: show purchase-links options.
- `INVALID_INPUT`: fix request payload.
- `RATE_LIMIT_EXCEEDED`: backoff and retry.
