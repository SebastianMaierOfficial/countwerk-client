import http from "http";
import https from "https";
import { URL } from "url";
import { CountwerkError } from "./errors";
import type { ApiResponse } from "./types";

export type HttpClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
};

type RequestOptions = {
  method: "POST";
  path: string;
  body?: Record<string, unknown>;
};

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

const isRetryableError = (err: unknown) => {
  if (err instanceof CountwerkError) {
    return isRetryableStatus(err.status);
  }
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code?: string }).code || "");
    return code === "ETIMEDOUT" || code === "ECONNRESET" || code === "EAI_AGAIN";
  }
  return false;
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/+$/, "");

const safeJsonParse = (input: string) => {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return undefined;
  }
};

export const requestJson = async <T>(
  client: HttpClientOptions,
  req: RequestOptions
): Promise<T> => {
  const baseUrl = normalizeBaseUrl(client.baseUrl);
  const timeoutMs = client.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = client.maxRetries ?? DEFAULT_MAX_RETRIES;

  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxRetries) {
    attempt += 1;
    try {
      return await executeRequest<T>(baseUrl, client.apiKey, timeoutMs, req);
    } catch (err) {
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

const executeRequest = async <T>(
  baseUrl: string,
  apiKey: string,
  timeoutMs: number,
  req: RequestOptions
): Promise<T> => {
  const url = new URL(req.path, baseUrl);
  const body = req.body ? JSON.stringify(req.body) : "";
  const transport = url.protocol === "https:" ? https : http;

  return new Promise<T>((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "Content-Length": Buffer.byteLength(body).toString(),
        },
      },
      (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          const parsed = data ? safeJsonParse(data) : undefined;
          const apiResponse = parsed as ApiResponse<T> | undefined;

          if (status >= 200 && status < 300 && apiResponse?.success !== false) {
            if (!apiResponse || apiResponse.data === undefined) {
              return resolve(undefined as T);
            }
            return resolve(apiResponse.data);
          }

          const code = apiResponse?.code || "HTTP_ERROR";
          const message = apiResponse?.message || code;
          const details = apiResponse?.data ?? parsed;
          return reject(new CountwerkError(message, code, status, details));
        });
      }
    );

    request.on("error", (err) => {
      reject(err);
    });

    request.setTimeout(timeoutMs, () => {
      const timeoutError = new Error("Request timed out");
      (timeoutError as { code?: string }).code = "ETIMEDOUT";
      request.destroy(timeoutError);
    });

    if (body) {
      request.write(body);
    }
    request.end();
  });
};
