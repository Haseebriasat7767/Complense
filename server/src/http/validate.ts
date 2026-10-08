/**
 * Tiny dependency-free request validation helpers.
 * All user input that reaches the domain layer passes through these.
 */
import { ApiError } from './errors.js';

export function requireObjectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.badRequest('A JSON object body is required.');
  }
  return body as Record<string, unknown>;
}

export function requireString(
  value: unknown,
  field: string,
  { min = 1, max = 500, trim = true }: { min?: number; max?: number; trim?: boolean } = {},
): string {
  if (typeof value !== 'string') throw ApiError.badRequest(`${field} must be a string.`);
  const out = trim ? value.trim() : value;
  if (out.length < min) throw ApiError.badRequest(`${field} must be at least ${min} character(s).`);
  if (out.length > max) throw ApiError.badRequest(`${field} must be at most ${max} characters.`);
  return out;
}

export function optionalString(value: unknown, field: string, max = 500): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requireString(value, field, { max });
}

/** Validates an email without a regex that can catastrophically backtrack. */
export function requireEmail(value: unknown, field = 'email'): string {
  const email = requireString(value, field, { max: 254 }).toLowerCase();
  const at = email.indexOf('@');
  const local = at > 0 ? email.slice(0, at) : '';
  const domain = at > 0 ? email.slice(at + 1) : '';
  const domainOk = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain);
  if (!local || !domainOk || /\s/.test(email)) {
    throw ApiError.badRequest(`${field} must be a valid email address.`);
  }
  return email;
}

export function requirePassword(value: unknown, field = 'password'): string {
  const password = requireString(value, field, { min: 10, max: 200, trim: false });
  const classes = [/[a-z]/, /[A-Z]/, /\d/].filter((re) => re.test(password)).length;
  if (classes < 2) {
    throw ApiError.badRequest(
      `${field} must include at least two of: lowercase letters, uppercase letters, numbers.`,
    );
  }
  return password;
}

export function requireEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  const raw = requireString(value, field, { max: 64 });
  if (!allowed.includes(raw as T)) {
    throw ApiError.badRequest(`${field} must be one of: ${allowed.join(', ')}.`);
  }
  return raw as T;
}

export function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requireEnum(value, field, allowed);
}

export function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw ApiError.badRequest(`${field} must be a boolean.`);
}

export function queryString(value: unknown, max = 120): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : undefined;
}

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}
