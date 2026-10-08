/**
 * Typed API errors. Clients always receive a safe, non-leaky message plus a
 * machine-readable code. Stack traces are never sent to the browser.
 */
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { logger } from '../logger.js';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'bad_request', message, details);
  }
  static unauthorized(message = 'Authentication required.') {
    return new ApiError(401, 'unauthorized', message);
  }
  static forbidden(message = 'You do not have access to this resource.') {
    return new ApiError(403, 'forbidden', message);
  }
  static notFound(message = 'Resource not found.') {
    return new ApiError(404, 'not_found', message);
  }
  static conflict(message: string) {
    return new ApiError(409, 'conflict', message);
  }
  static payloadTooLarge(message: string) {
    return new ApiError(413, 'payload_too_large', message);
  }
  static unsupportedMedia(message: string) {
    return new ApiError(415, 'unsupported_media_type', message);
  }
  static internal(message = 'Something went wrong on our side.') {
    return new ApiError(500, 'internal_error', message);
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'not_found', message: 'Endpoint not found.' } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    if (err.status >= 500) logger.error(err.message, { code: err.code });
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  // Multer / body-parser errors surfaced by their stable type/code rather than
  // leaking parser internals to the client.
  const anyErr = err as { name?: string; type?: string; code?: string; message?: string };
  if (anyErr?.type === 'entity.parse.failed') {
    res.status(400).json({
      error: { code: 'invalid_json', message: 'Request body must contain valid JSON.' },
    });
    return;
  }
  if (anyErr?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'payload_too_large', message: 'Request body exceeds the 1 MB limit.' } });
    return;
  }
  if (anyErr?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: { code: 'payload_too_large', message: `File exceeds the ${Math.round(config.uploads.maxBytes / (1024 * 1024))} MB limit.` },
    });
    return;
  }
  if (anyErr?.name === 'MulterError') {
    res.status(400).json({ error: { code: 'bad_request', message: 'Upload rejected by the server.' } });
    return;
  }

  logger.error('Unhandled error', {
    message: anyErr?.message ?? String(err),
    stack: config.isProduction ? undefined : (err as Error)?.stack,
  });
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong while processing the request.',
    },
  });
}

/** Wraps async route handlers so rejections reach the error middleware. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req as T, res, next).catch(next);
  };
}
