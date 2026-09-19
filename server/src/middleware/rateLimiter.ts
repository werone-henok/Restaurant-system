import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter — applied to all routes.
 * 500 requests per 15 minutes per IP.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

/**
 * Auth rate limiter — applied only to /api/auth/* routes.
 * 20 attempts per 15 minutes per IP (covers login, register, verify-pin).
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait 15 minutes and try again.' }
});
