"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCountwerkClient = void 0;
const errors_1 = require("./errors");
const http_1 = require("./http");
const validateAmount = (amount) => Number.isInteger(amount) && amount > 0;
const createCountwerkClient = (config) => {
    const client = {
        baseUrl: config.baseUrl ?? "https://api.countwerk.com/",
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs,
        maxRetries: config.maxRetries,
    };
    return {
        resolveOrder: (order_id) => (0, http_1.requestJson)(client, {
            method: "POST",
            path: "/api/credits/resolve-order",
            body: { order_id },
        }),
        purchaseLinks: (request) => (0, http_1.requestJson)(client, {
            method: "POST",
            path: "/api/purchase-links",
            body: request,
        }),
        balance: (account_id) => (0, http_1.requestJson)(client, {
            method: "POST",
            path: "/api/credits/balance",
            body: { account_id },
        }),
        deduct: (request) => {
            if (!validateAmount(request.amount)) {
                throw (0, errors_1.createValidationError)("amount must be an integer > 0", "INVALID_AMOUNT");
            }
            return (0, http_1.requestJson)(client, {
                method: "POST",
                path: "/api/credits/deduct",
                body: request,
            });
        },
        reserve: (request) => {
            if (!validateAmount(request.amount)) {
                throw (0, errors_1.createValidationError)("amount must be an integer > 0", "INVALID_AMOUNT");
            }
            return (0, http_1.requestJson)(client, {
                method: "POST",
                path: "/api/credits/reserve",
                body: request,
            });
        },
        confirmReservation: (request) => (0, http_1.requestJson)(client, {
            method: "POST",
            path: "/api/credits/confirm-reservation",
            body: request,
        }),
        cancelReservation: (request) => (0, http_1.requestJson)(client, {
            method: "POST",
            path: "/api/credits/cancel-reservation",
            body: request,
        }),
    };
};
exports.createCountwerkClient = createCountwerkClient;
