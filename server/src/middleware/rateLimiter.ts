import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter — applied to all routes.
 * 500 requests per 10 seconds per IP.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

/**
 * Auth rate limiter — applied only to /api/auth/* routes.
 * 20 attempts per 10 seconds per IP (covers login, register, verify-pin).
 */
export const authRateLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait 10 seconds and try again.' }
});

/**
 * Upload rate limiter — applied only to /api/upload routes.
 * 10 uploads per 10 seconds per IP (prevents upload-based DoS).
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload requests. Please wait 10 seconds and try again.' }
});

/**
 * Payment rate limiter — applied to /api/payments/* routes.
 * 30 payments per 10 seconds per IP.
 */
export const paymentRateLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests. Please slow down.' }
});
