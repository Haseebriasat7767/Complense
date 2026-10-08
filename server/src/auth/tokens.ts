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

export function verifySessionToken(token: string): SessionClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw ApiError.unauthorized('Malformed session token.');
  const [encodedHeader, encodedPayload, signature] = parts;

  const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
    alg?: string;
  };
  if (header.alg !== 'HS256') throw ApiError.unauthorized('Unsupported token algorithm.');

  const expected = sign(`${encodedHeader}.${encodedPayload}`);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    throw ApiError.unauthorized('Invalid session signature.');
  }

  const claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionClaims;
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
  return claims;
}
