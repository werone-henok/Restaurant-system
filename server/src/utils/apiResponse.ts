/**
 * apiResponse — consistent JSON envelope for all API responses.
 *
 * Success:  { success: true,  data: T,    meta?: any }
 * Error:    { success: false, error: { message, code }, meta?: any }
 */
import type { Response } from 'express';

interface SuccessPayload<T> {
  data: T;
  meta?: Record<string, any>;
  statusCode?: number;
  message?: string;
}

interface ErrorPayload {
  message: string;
  code?: string;
  statusCode?: number;
  meta?: Record<string, any>;
}

export function sendSuccess<T>(res: Response, payload: SuccessPayload<T>): void {
  const status = payload.statusCode ?? 200;
  res.status(status).json({
    success: true,
    ...(payload.message ? { message: payload.message } : {}),
    data: payload.data,
    ...(payload.meta ? { meta: payload.meta } : {})
  });
}

export function sendError(res: Response, payload: ErrorPayload): void {
  const status = payload.statusCode ?? 500;
  res.status(status).json({
    success: false,
    error: {
      message: payload.message,
      code: payload.code ?? 'ERR_UNKNOWN'
    },
    ...(payload.meta ? { meta: payload.meta } : {})
  });
}

/**
 * Shorthand for 201 Created with data + optional message.
 */
export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, { data, statusCode: 201, message });
}
