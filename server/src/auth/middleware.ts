/**
 * Authentication and organisation-level authorisation.
 *
 * Every protected route runs `requireAuth`, which validates the session token
 * and confirms the organisation still exists. Resource routes then scope all
 * queries by `session.org`, so a token for one organisation can never read
 * another organisation's evidence, reports or settings.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ApiError } from '../http/errors.js';
import { getStore } from '../store/index.js';
import { verifySessionToken, type SessionClaims } from './tokens.js';

function readToken(req: Request): string | null {
  const header = req.header('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return null;
}

export function requireAuth(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = readToken(req);
    if (!token) {
      next(ApiError.unauthorized('Sign in to continue.'));
      return;
    }
    let session: SessionClaims;
    try {
      session = verifySessionToken(token);
    } catch (error) {
      next(error);
      return;
    }
    req.session = session;
    // Organisation-level authorisation: the org must exist and be active.
    getStore()
      .getOrganization(session.org)
      .then((organization) => {
        if (!organization) {
          next(ApiError.forbidden('This organisation is no longer available.'));
          return;
        }
        next();
      })
      .catch(next);
  };
}

/** Session claims, guaranteed present inside authenticated handlers. */
export function sessionOf(req: Request): SessionClaims {
  if (!req.session) throw ApiError.unauthorized('Sign in to continue.');
  return req.session;
}

/** Guard for any resource that carries an organizationId. */
export function assertSameOrganization(req: Request, organizationId: string): void {
  if (sessionOf(req).org !== organizationId) {
    throw ApiError.forbidden('This resource belongs to a different organisation.');
  }
}
