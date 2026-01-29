export type CountwerkErrorDetails = Record<string, unknown> | unknown;
export declare class CountwerkError extends Error {
    code: string;
    status: number;
    details?: CountwerkErrorDetails;
    constructor(message: string, code: string, status: number, details?: CountwerkErrorDetails);
}
export declare const createValidationError: (message: string, code?: string) => CountwerkError;
