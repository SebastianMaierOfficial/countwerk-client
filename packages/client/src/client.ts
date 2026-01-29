import { createValidationError } from "./errors";
import { requestJson, type HttpClientOptions } from "./http";
import type {
  BalanceRequest,
  BalanceResponse,
  CancelReservationRequest,
  CancelReservationResponse,
  ConfirmReservationRequest,
  ConfirmReservationResponse,
  DeductRequest,
  DeductResponse,
  PurchaseLinksRequest,
  PurchaseLinksResponse,
  ReserveRequest,
  ReserveResponse,
  ResolveOrderRequest,
  ResolveOrderResponse,
} from "./types";

export type CountwerkClientConfig = {
  baseUrl?: string;
  apiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
};

export type CountwerkClient = {
  resolveOrder: (order_id: string) => Promise<ResolveOrderResponse>;
  purchaseLinks: (request: PurchaseLinksRequest) => Promise<PurchaseLinksResponse>;
  balance: (account_id: string) => Promise<BalanceResponse>;
  deduct: (request: DeductRequest) => Promise<DeductResponse>;
  reserve: (request: ReserveRequest) => Promise<ReserveResponse>;
  confirmReservation: (
    request: ConfirmReservationRequest
  ) => Promise<ConfirmReservationResponse>;
  cancelReservation: (
    request: CancelReservationRequest
  ) => Promise<CancelReservationResponse>;
};

const validateAmount = (amount: number) =>
  Number.isInteger(amount) && amount > 0;

export const createCountwerkClient = (
  config: CountwerkClientConfig
): CountwerkClient => {
  const client: HttpClientOptions = {
    baseUrl: config.baseUrl ?? "https://api.countwerk.com/",
    apiKey: config.apiKey,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  };

  return {
    resolveOrder: (order_id: string) =>
      requestJson<ResolveOrderResponse>(client, {
        method: "POST",
        path: "/api/credits/resolve-order",
        body: { order_id } satisfies ResolveOrderRequest,
      }),

    purchaseLinks: (request: PurchaseLinksRequest) =>
      requestJson<PurchaseLinksResponse>(client, {
        method: "POST",
        path: "/api/purchase-links",
        body: request,
      }),

    balance: (account_id: string) =>
      requestJson<BalanceResponse>(client, {
        method: "POST",
        path: "/api/credits/balance",
        body: { account_id } satisfies BalanceRequest,
      }),

    deduct: (request: DeductRequest) => {
      if (!validateAmount(request.amount)) {
        throw createValidationError("amount must be an integer > 0", "INVALID_AMOUNT");
      }
      return requestJson<DeductResponse>(client, {
        method: "POST",
        path: "/api/credits/deduct",
        body: request,
      });
    },

    reserve: (request: ReserveRequest) => {
      if (!validateAmount(request.amount)) {
        throw createValidationError("amount must be an integer > 0", "INVALID_AMOUNT");
      }
      return requestJson<ReserveResponse>(client, {
        method: "POST",
        path: "/api/credits/reserve",
        body: request,
      });
    },

    confirmReservation: (request: ConfirmReservationRequest) =>
      requestJson<ConfirmReservationResponse>(client, {
        method: "POST",
        path: "/api/credits/confirm-reservation",
        body: request,
      }),

    cancelReservation: (request: CancelReservationRequest) =>
      requestJson<CancelReservationResponse>(client, {
        method: "POST",
        path: "/api/credits/cancel-reservation",
        body: request,
      }),
  };
};
