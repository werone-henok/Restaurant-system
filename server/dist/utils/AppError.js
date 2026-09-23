/**
 * AppError — structured error class for the GourmetOS API.
 * All route handlers can throw AppError and the centralized error handler
 * will format a consistent JSON response.
 */
export class AppError extends Error {
    statusCode;
    code;
    isOperational;
    constructor(statusCode, message, code = 'ERR_UNKNOWN', isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
    // ── Convenience factory methods ─────────────────────────────────
    static badRequest(message, code = 'ERR_BAD_REQUEST') {
        return new AppError(400, message, code);
    }
    static unauthorized(message = 'Authentication required', code = 'ERR_UNAUTHORIZED') {
        return new AppError(401, message, code);
    }
    static forbidden(message = 'Access denied', code = 'ERR_FORBIDDEN') {
        return new AppError(403, message, code);
    }
    static notFound(entity = 'Resource', code = 'ERR_NOT_FOUND') {
        return new AppError(404, `${entity} not found`, code);
    }
    static conflict(message, code = 'ERR_CONFLICT') {
        return new AppError(409, message, code);
    }
    static tooMany(message = 'Too many requests', code = 'ERR_RATE_LIMIT') {
        return new AppError(429, message, code);
    }
    static internal(message = 'Internal server error', code = 'ERR_INTERNAL') {
        return new AppError(500, message, code, false);
    }
}
