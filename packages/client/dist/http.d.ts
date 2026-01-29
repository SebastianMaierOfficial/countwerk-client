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
export declare const requestJson: <T>(client: HttpClientOptions, req: RequestOptions) => Promise<T>;
export {};
