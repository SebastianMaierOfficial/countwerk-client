export type CountwerkErrorDetails = Record<string, unknown> | unknown;

export class CountwerkError extends Error {
  code: string;
  status: number;
  details?: CountwerkErrorDetails;

  constructor(message: string, code: string, status: number, details?: CountwerkErrorDetails) {
    super(message);
    this.name = "CountwerkError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const createValidationError = (message: string, code = "INVALID_INPUT") =>
  new CountwerkError(message, code, 400);
