"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidationError = exports.CountwerkError = void 0;
class CountwerkError extends Error {
    constructor(message, code, status, details) {
        super(message);
        this.name = "CountwerkError";
        this.code = code;
        this.status = status;
        this.details = details;
    }
}
exports.CountwerkError = CountwerkError;
const createValidationError = (message, code = "INVALID_INPUT") => new CountwerkError(message, code, 400);
exports.createValidationError = createValidationError;
