/**
 * Session tokens: compact HS256 JWTs signed with node:crypto.
 * Kept dependency-free on purpose (no jsonwebtoken).
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { ApiError } from '../http/errors.js';

export type SessionClaims = {
  sub: string; // user id
  email: string;
  org: string; // organization id
  role: string;
  demo: boolean;
  iat: number;
  exp: number;
};

const HEADER = { alg: 'HS256', typ: 'JWT' } as const;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string): string {
  return crypto.createHmac('sha256', config.session.secret).update(data).digest('base64url');
}

export function createSessionToken(
  claims: Omit<SessionClaims, 'iat' | 'exp'>,
  ttlHours = config.session.ttlHours,
): { token: string; expiresAt: string } {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + Math.round(ttlHours * 3600);
  const payload: SessionClaims = { ...claims, iat: issuedAt, exp: expiresAt };
  const encodedHeader = b64url(JSON.stringify(HEADER));
  const encodedPayload = b64url(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);
  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

/**
 * Decode one base64url segment into JSON.
 *
 * Any malformed input (bad base64, non-UTF8 bytes, non-JSON text, arrays,
 * primitives) is a client error, never a server error: a tampered or corrupt
 * token must produce a 401 so the client can sign the user in again.
 */
function decodeSegment<T>(segment: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    throw ApiError.unauthorized('Malformed session token.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw ApiError.unauthorized('Malformed session token.');
  }
  return parsed as T;
}

export function verifySessionToken(token: string): SessionClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw ApiError.unauthorized('Malformed session token.');
  const [encodedHeader, encodedPayload, signature] = parts;

  const header = decodeSegment<{ alg?: string }>(encodedHeader);
  if (header.alg !== 'HS256') throw ApiError.unauthorized('Unsupported token algorithm.');

  const expected = sign(`${encodedHeader}.${encodedPayload}`);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    throw ApiError.unauthorized('Invalid session signature.');
  }

  const claims = decodeSegment<SessionClaims>(encodedPayload);
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
  // A signed token always carries these claims; validate anyway so a malformed
  // token can never reach a handler with an unusable organisation scope.
  if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.org !== 'string' || !claims.org) {
    throw ApiError.unauthorized('Malformed session token.');
  }
  return claims;
}
