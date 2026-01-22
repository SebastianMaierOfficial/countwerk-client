# Consumer Contract (SSoT)

This document is the single source of truth for external consumer integrations.
All fields below are **required** unless explicitly marked **optional**.

Optional SDK: A thin Node.js client is available via npm
(`@sebastianmaierofficial/countwerk-client`) for those who prefer not to write
raw HTTP code. The HTTP contract below remains the SSoT.

## Auth

All endpoints require:
- Header: `X-API-Key`
- Header: `Content-Type: application/json`

## Identifiers

- `account_id` (required): your stable account/user id.
- `ai_product_id` (required): the AI product being billed.
- `order_id` (required for resolve-order).
- `transaction_id` (required when credits are added from Digistore24).

## Endpoints

### POST /api/credits/resolve-order

Resolve a Digistore24 `order_id` to the associated `account_id`.

Request body:
- `order_id` (required)

Success response:

```json
{
  "success": true,
  "data": {
    "order_id": "ORDER_123",
    "account_id": "acct_123",
    "ai_product_id": "ai_product_001"
  }
}
```

Errors:
- `ORDER_NOT_FOUND`
- `ORDER_NOT_MAPPED_YET`
- `API_KEY_MISSING`, `INVALID_API_KEY`
- `INVALID_INPUT`

Error example:

```json
{ "success": false, "code": "ORDER_NOT_FOUND" }
```

---

### POST /api/purchase-links

Generate account-bound Digistore24 purchase options for an AI product.

Request body:
- `ai_product_id` (required)
- `account_id` (required)

Rules:
- DS24 API key is mandatory; missing/invalid keys may return a hard failure or a response with `options[]` disabled.
- `options[]` is deterministic: upgrades (tier_rank asc), downgrades (tier_rank asc), topups (credits desc).
- Do not construct DS24 upgrade URLs manually.

Response data:
- `current_order_id` (nullable)
- `current_tier_product_id` (nullable)
- `options[]` (required)
  - Required fields per option:
    - `type`: `topup | upgrade | downgrade | manage`
    - `linkMode`: `create_buy_url | ds_upgrade_url`
    - `effectiveAtPolicy`: `immediate | end_of_period | unknown`
    - `expectedPolicy`: `immediate | end_of_period | unknown`
    - `enabled`: boolean
    - `disabledReason`: string or null
  - Optional fields:
    - `toProductId`
    - `fromProductId`
    - `url` (null when disabled)
    - `label`
    - `description`

Success example (mixed options, includes enabled=false):

```json
{
  "success": true,
  "data": {
    "ai_product_id": "ai_product_001",
    "account_id": "acct_123",
    "current_order_id": "ORDER_123",
    "current_tier_product_id": "PRO_001",
    "options": [
      {
        "type": "topup",
        "toProductId": "TOPUP_100",
        "fromProductId": null,
        "linkMode": "create_buy_url",
        "url": "https://www.digistore24.com/order/...",
        "effectiveAtPolicy": "immediate",
        "expectedPolicy": "immediate",
        "enabled": true,
        "disabledReason": null,
        "label": "Topup 100",
        "description": "Top up 100 credits"
      },
      {
        "type": "downgrade",
        "toProductId": "PRO_000",
        "fromProductId": "PRO_001",
        "linkMode": "ds_upgrade_url",
        "url": null,
        "effectiveAtPolicy": "end_of_period",
        "expectedPolicy": "end_of_period",
        "enabled": false,
        "disabledReason": "MISSING_ORDER_ID",
        "label": "Starter",
        "description": "Downgrade to Starter"
      }
    ]
  }
}
```

Error example (DS24 key missing):

```json
{
  "success": false,
  "code": "DS24_KEY_REQUIRED",
  "data": {
    "options": [
      {
        "type": "topup",
        "toProductId": "TOPUP_100",
        "fromProductId": null,
        "linkMode": "create_buy_url",
        "url": null,
        "effectiveAtPolicy": "immediate",
        "expectedPolicy": "immediate",
        "enabled": false,
        "disabledReason": "DS24_KEY_REQUIRED",
        "label": "Topup 100",
        "description": "Top up 100 credits"
      }
    ]
  }
}
```

---

### POST /api/credits/balance

Return balance for the account.

Request body:
- `account_id` (required)

Success example:

```json
{
  "success": true,
  "data": {
    "balance": 1000,
    "reservedBalance": 0,
    "availableBalance": 1000,
    "totalEarned": 1000,
    "totalSpent": 0,
    "nextExpiration": null
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Errors:
- `API_KEY_MISSING`, `INVALID_API_KEY`
- `MISSING_REQUIRED_FIELDS`
- `RATE_LIMIT_EXCEEDED`

---

### POST /api/credits/deduct

Deduct credits for a usage event.

Request body:
- `account_id` (required)
- `operation` (required; string 3..64, chars `[a-z0-9._-]`)
- `amount` (required; integer)
- `usage_event_id` (required; stable idempotency key per logical usage)
- `description` (optional)
- `metadata` (optional; JSON object)

Success example:

```json
{
  "success": true,
  "data": {
    "transactionId": "txn_123",
    "newBalance": 900,
    "deductedAmount": 1,
    "operation": "app.chat.reply",
    "description": "Chat reply"
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Idempotency example:

```json
{
  "account_id": "acct_123",
  "operation": "app.chat.reply",
  "amount": 1,
  "usage_event_id": "turn-2026-01-20-001",
  "description": "Chat reply"
}
```

Errors:
- `INSUFFICIENT_CREDITS`
- `INVALID_INPUT`
- `MISSING_USAGE_EVENT_ID`
- `INVALID_USAGE_EVENT_ID`

---

### POST /api/credits/reserve

Reserve credits for long-running work.

Request body:
- `account_id` (required)
- `operation` (required)
- `amount` (required)
- `validityMinutes` (optional; default 60)
- `description` (optional)

Success example:

```json
{
  "success": true,
  "data": {
    "reservationId": "RESERVATION_123",
    "operation": "job.train",
    "amount": 2,
    "expiresAt": "2025-01-01T00:00:00.000Z",
    "description": "Training job"
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### POST /api/credits/confirm-reservation

Confirm a reservation after successful work.

Request body:
- `reservationId` (required)
- `actualAmount` (optional; defaults to reserved amount)
- `description` (optional)

Success example:

```json
{
  "success": true,
  "data": {
    "reservationId": "RESERVATION_123",
    "confirmed": true,
    "actualAmount": 1,
    "description": "Training finished"
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### POST /api/credits/cancel-reservation

Cancel a reservation after a failure or abort.

Request body:
- `reservationId` (required)
- `reason` (optional)

Success example:

```json
{
  "success": true,
  "data": {
    "reservationId": "RESERVATION_123",
    "cancelled": true,
    "reason": "Job failed"
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```
