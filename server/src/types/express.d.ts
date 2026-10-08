import type { SessionClaims } from '../auth/tokens.js';

declare global {
  namespace Express {
    interface Request {
      /** Populated by the authentication middleware for protected routes. */
      session?: SessionClaims;
      /** Correlation id used in logs and error responses. */
      requestId?: string;
    }
  }
}

export {};
