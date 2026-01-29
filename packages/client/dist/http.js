"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestJson = void 0;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
const errors_1 = require("./errors");
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isRetryableStatus = (status) => status === 429 || status >= 500;
const isRetryableError = (err) => {
    if (err instanceof errors_1.CountwerkError) {
        return isRetryableStatus(err.status);
    }
    if (err && typeof err === "object" && "code" in err) {
        const code = String(err.code || "");
        return code === "ETIMEDOUT" || code === "ECONNRESET" || code === "EAI_AGAIN";
    }
    return false;
};
const normalizeBaseUrl = (baseUrl) => baseUrl.replace(/\/+$/, "");
const safeJsonParse = (input) => {
    try {
        return JSON.parse(input);
    }
    catch {
        return undefined;
    }
};
const requestJson = async (client, req) => {
    const baseUrl = normalizeBaseUrl(client.baseUrl);
    const timeoutMs = client.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = client.maxRetries ?? DEFAULT_MAX_RETRIES;
    let attempt = 0;
    let lastError;
    while (attempt < maxRetries) {
        attempt += 1;
        try {
            return await executeRequest(baseUrl, client.apiKey, timeoutMs, req);
        }
        catch (err) {
            lastError = err;
            if (!isRetryableError(err) || attempt >= maxRetries) {
                throw err;
            }
            const backoff = 200 * Math.pow(2, attempt - 1);
            await sleep(backoff);
        }
    }
    throw lastError;
};
exports.requestJson = requestJson;
const executeRequest = async (baseUrl, apiKey, timeoutMs, req) => {
    const url = new url_1.URL(req.path, baseUrl);
    const body = req.body ? JSON.stringify(req.body) : "";
    const transport = url.protocol === "https:" ? https_1.default : http_1.default;
    return new Promise((resolve, reject) => {
        const request = transport.request(url, {
            method: req.method,
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": apiKey,
                "Content-Length": Buffer.byteLength(body).toString(),
            },
        }, (response) => {
            let data = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => {
                data += chunk;
            });
            response.on("end", () => {
                const status = response.statusCode ?? 0;
                const parsed = data ? safeJsonParse(data) : undefined;
                const apiResponse = parsed;
                if (status >= 200 && status < 300 && apiResponse?.success !== false) {
                    if (!apiResponse || apiResponse.data === undefined) {
                        return resolve(undefined);
                    }
                    return resolve(apiResponse.data);
                }
                const code = apiResponse?.code || "HTTP_ERROR";
                const message = apiResponse?.message || code;
                const details = apiResponse?.data ?? parsed;
                return reject(new errors_1.CountwerkError(message, code, status, details));
            });
        });
        request.on("error", (err) => {
            reject(err);
        });
        request.setTimeout(timeoutMs, () => {
            const timeoutError = new Error("Request timed out");
            timeoutError.code = "ETIMEDOUT";
            request.destroy(timeoutError);
        });
        if (body) {
            request.write(body);
        }
        request.end();
    });
};
