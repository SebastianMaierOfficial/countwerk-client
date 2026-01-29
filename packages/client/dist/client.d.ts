import type { BalanceResponse, CancelReservationRequest, CancelReservationResponse, ConfirmReservationRequest, ConfirmReservationResponse, DeductRequest, DeductResponse, PurchaseLinksRequest, PurchaseLinksResponse, ReserveRequest, ReserveResponse, ResolveOrderResponse } from "./types";
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
    confirmReservation: (request: ConfirmReservationRequest) => Promise<ConfirmReservationResponse>;
    cancelReservation: (request: CancelReservationRequest) => Promise<CancelReservationResponse>;
};
export declare const createCountwerkClient: (config: CountwerkClientConfig) => CountwerkClient;
