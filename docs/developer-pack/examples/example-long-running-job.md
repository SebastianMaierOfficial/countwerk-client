# Example: Long-Running Job (Reserve / Confirm / Cancel)

Goal: reserve credits for a long job, confirm on success, cancel on failure.

## Flow

1) Reserve credits before starting the job.
2) Run the job.
3) Confirm reservation on success, or cancel on failure.

## HTTP Examples

### 1) Reserve

```
POST /api/credits/reserve
X-API-Key: <API_KEY>
Content-Type: application/json

{
  "account_id": "acct_123",
  "operation": "job.train",
  "amount": 2,
  "validityMinutes": 60,
  "description": "Training job"
}
```

### 2) Confirm

```
POST /api/credits/confirm-reservation
X-API-Key: <API_KEY>
Content-Type: application/json

{ "reservationId": "RESERVATION_123", "actualAmount": 2 }
```

### 3) Cancel

```
POST /api/credits/cancel-reservation
X-API-Key: <API_KEY>
Content-Type: application/json

{ "reservationId": "RESERVATION_123", "reason": "Job failed" }
```

## Pseudo-code

```
function runLongJob(accountId, jobPayload) {
  let reservationId = null;
  try {
    const res = countwerk.reserve({
      account_id: accountId,
      operation: "job.train",
      amount: 2,
      validityMinutes: 60
    });
    reservationId = res.reservationId;

    const result = runJob(jobPayload);

    countwerk.confirmReservation({
      reservationId,
      actualAmount: 2
    });

    return result;
  } catch (err) {
    if (reservationId) {
      countwerk.cancelReservation({
        reservationId,
        reason: "Job failed"
      });
    }
    throw err;
  }
}
```

## Expected Failure Cases

- `INSUFFICIENT_CREDITS` on reserve: show purchase options.
- `RESERVATION_NOT_FOUND` on confirm/cancel: treat as already handled.
- `INVALID_INPUT`: fix payload (operation/amount/etc).
- `RATE_LIMIT_EXCEEDED`: backoff and retry.
