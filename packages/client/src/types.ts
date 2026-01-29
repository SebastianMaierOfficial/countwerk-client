export type ResolveOrderRequest = {
  order_id: string;
};

export type ResolveOrderResponse = {
  order_id: string;
  account_id: string;
  ai_product_id: string;
};

export type PurchaseLinksRequest = {
  ai_product_id: string;
  account_id: string;
};

export type PurchaseOption = {
  type: "topup" | "upgrade" | "downgrade" | "manage";
  linkMode: "create_buy_url" | "ds_upgrade_url";
  effectiveAtPolicy: "immediate" | "end_of_period" | "unknown";
  expectedPolicy: "immediate" | "end_of_period" | "unknown";
  enabled: boolean;
  disabledReason: string | null;
  toProductId?: string | null;
  fromProductId?: string | null;
  url?: string | null;
  label?: string;
  description?: string;
};

export type PurchaseLinksResponse = {
  ai_product_id: string;
  account_id: string;
  current_order_id: string | null;
  current_tier_product_id: string | null;
  options: PurchaseOption[];
};

export type BalanceRequest = {
  account_id: string;
};

export type BalanceResponse = {
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  totalEarned: number;
  totalSpent: number;
  nextExpiration: string | null;
};

export type DeductRequest = {
  account_id: string;
  operation: string;
  amount: number;
  usage_event_id: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type DeductResponse = {
  transactionId: string;
  newBalance: number;
  deductedAmount: number;
  operation: string;
  description?: string;
};

export type ReserveRequest = {
  account_id: string;
  operation: string;
  amount: number;
  validityMinutes?: number;
  description?: string;
};

export type ReserveResponse = {
  reservationId: string;
  operation: string;
  amount: number;
  expiresAt: string;
  description?: string;
};

export type ConfirmReservationRequest = {
  reservationId: string;
  actualAmount?: number;
  description?: string;
};

export type ConfirmReservationResponse = {
  reservationId: string;
  confirmed: boolean;
  actualAmount: number;
  description?: string;
};

export type CancelReservationRequest = {
  reservationId: string;
  reason?: string;
};

export type CancelReservationResponse = {
  reservationId: string;
  cancelled: boolean;
  reason?: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  code?: string;
  message?: string;
  timestamp?: string;
};
