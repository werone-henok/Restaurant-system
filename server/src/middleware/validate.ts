/**
 * Zod validation middleware factory.
 *
 * Usage in route files:
 *   import { validate } from '../middleware/validate.js';
 *   import { loginSchema } from '../schemas/auth.schemas.js';
 *
 *   router.post('/login', validate(loginSchema), (req, res) => { ... });
 *
 * The validated+parsed body is set back onto `req.body`, so route handlers
 * always receive a typed, trimmed, coerced payload.
 */
import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

interface ValidateOptions {
  /** Which part of the request to validate. Defaults to 'body'. */
  source?: 'body' | 'query' | 'params';
}

export function validate(schema: ZodSchema, options: ValidateOptions = {}) {
  const source = options.source ?? 'body';

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      // Replace raw data with validated & coerced data
      (req as any)[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
          code: i.code
        }));
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            code: 'ERR_VALIDATION',
            details: issues
          }
        });
      }
      next(err);
    }
  };
}
