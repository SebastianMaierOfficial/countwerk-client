# Errors (Stable Codes)

This list is the stable, machine-readable error code set exposed to consumers.
Return codes may be accompanied by HTTP status codes as noted below.

## Auth / Access

- `API_KEY_MISSING` (401): API key header missing.
- `INVALID_API_KEY` (401): API key invalid.
- `FORBIDDEN` (403): Key lacks access to requested resource.

## Input / Validation

- `INVALID_INPUT` (400): Generic invalid request payload.
- `MISSING_REQUIRED_FIELDS` (400): One or more required fields missing.
- `MISSING_ACCOUNT_ID` (400): `account_id` missing.
- `MISSING_OPERATION` (400): `operation` missing.
- `INVALID_OPERATION` (400): `operation` format invalid.
- `INVALID_AMOUNT` (400): `amount` invalid (must be integer > 0).
- `MISSING_USAGE_EVENT_ID` (400): `usage_event_id` missing.
- `INVALID_USAGE_EVENT_ID` (400): `usage_event_id` invalid.
- `MISSING_RESERVATION_ID` (400): `reservationId` missing.
- `MISSING_SOURCE` (400): `source` missing (credits/add).
- `INVALID_SOURCE` (400): `source` invalid.
- `MISSING_PRODUCT_ID` (400): `productId` missing in source.
- `MISSING_ORDER_ID` (400): `orderId` missing in source.
- `MISSING_TRANSACTION_ID` (400): `transactionId` missing in source.

## Commerce / DS24

- `DS24_KEY_REQUIRED` (409): DS24 API key not configured.
- `DS24_KEY_INVALID` (409): DS24 API key invalid.
- `DS24_KEY_FORBIDDEN` (403): DS24 key is unauthorized.
- `DS24_BAD_REQUEST` (400): DS24 rejected the request.
- `DS24_RATE_LIMITED` (429): DS24 rate limit exceeded.
- `DS24_TEMPORARY_ERROR` (503): DS24 temporary error.

## Orders

- `ORDER_NOT_FOUND` (404): DS24 order not found.
- `ORDER_NOT_MAPPED_YET` (409): Order exists but not linked to an account yet.

## Credits / Balance

- `INSUFFICIENT_CREDITS` (402): Not enough credits to complete the operation.
- `RATE_LIMIT_EXCEEDED` (429): Too many requests.

## Reservations

- `RESERVATION_NOT_FOUND` (404): Reservation not found (idempotent; safe to ignore).

## Server Errors

- `BALANCE_ERROR` (500): Balance lookup failed.
- `DEDUCTION_ERROR` (500): Deduction failed.
- `TRANSACTIONS_ERROR` (500): Transactions retrieval failed.
- `RESERVATION_ERROR` (500): Reservation failed.
- `CONFIRMATION_ERROR` (500): Reservation confirmation failed.
- `CANCELLATION_ERROR` (500): Reservation cancellation failed.
- `ADD_CREDITS_ERROR` (500): Add-credits failed.
- `INTERNAL_ERROR` (500): Generic server error.

## Recommended Consumer Behavior (Summary)

- 401/403: stop and fix credentials/permissions.
- 402: show purchase options.
- 409 (order not mapped / DS24 key required): retry later or surface setup steps.
- 429: backoff and retry.
- 5xx: retry with exponential backoff; alert if persistent.
