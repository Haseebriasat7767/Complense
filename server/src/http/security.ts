/**
 * Baseline HTTP hardening + a small in-memory rate limiter.
 * Deliberately dependency-free (no helmet/express-rate-limit).
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { config } from '../config.js';
import { ApiError } from './errors.js';

export function securityHeaders(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // In development/preview the app is embedded by the hosting preview frame,
    // so framing is only restricted in production (same-origin deployments).
    if (config.isProduction) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  };
}

/**
 * Optional CORS headers for a separately hosted web client.
 *
 * Disabled unless CORS_ORIGINS is set, so the default same-origin deployment
 * exposes no cross-origin access at all. `*` allows any origin (demo use only).
 * Credentials are never enabled — the client sends a bearer token instead.
 */
export function corsHeaders(): RequestHandler {
  const allowed = config.cors.origins;
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.header('origin');
    if (allowed.length === 0 || !origin) {
      next();
      return;
    }
    const permitted = allowed.includes('*') || allowed.includes(origin.replace(/\/$/, ''));
    if (!permitted) {
      // Not an allowed origin: answer preflights without CORS headers.
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,accept');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window limiter keyed by IP + bucket name.
 * Note: single-instance only — swap for a shared store in a multi-instance deploy.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  name: string;
  message?: string;
}): RequestHandler {
  const buckets = new Map<string, Bucket>();

  // Opportunistic cleanup so the map cannot grow without bound.
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  }, options.windowMs).unref?.();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${options.name}:${req.ip ?? 'unknown'}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', options.max - 1);
      next();
      return;
    }

    bucket.count += 1;
    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfter);
      next(
        new ApiError(
          429,
          'rate_limited',
          options.message ?? 'Too many requests. Please slow down and try again shortly.',
        ),
      );
      return;
    }
    next();
  };
}
