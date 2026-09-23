import { AppError } from '../utils/AppError.js';
import { ZodError } from 'zod';
export function errorHandler(err, _req, res, _next) {
    // ── Zod validation errors ────────────────────────────────────────
    if (err instanceof ZodError) {
        const issues = err.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message
        }));
        res.status(400).json({
            success: false,
            error: {
                message: 'Validation failed',
                code: 'ERR_VALIDATION',
                details: issues
            }
        });
        return;
    }
    // ── Known operational errors ─────────────────────────────────────
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                message: err.message,
                code: err.code
            }
        });
        return;
    }
    // ── Unexpected / programmer errors ───────────────────────────────
    console.error('Unhandled Error:', err);
    res.status(500).json({
        success: false,
        error: {
            message: err.message || 'An unexpected error occurred',
            code: 'ERR_INTERNAL'
        }
    });
}
/**
 * 404 catch-all for unmatched routes. Register AFTER all route mounts
 * but BEFORE the errorHandler.
 */
export function notFoundHandler(_req, res) {
    res.status(404).json({
        success: false,
        error: {
            message: 'The requested resource was not found',
            code: 'ERR_NOT_FOUND'
        }
    });
}
