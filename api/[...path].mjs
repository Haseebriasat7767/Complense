/**
 * Catch-all API function: `/api/*`.
 *
 * Vercel routes every request under `/api` to this file (the `vercel.json`
 * rewrite to `/api` resolves to the same handler). The original request URL is
 * preserved, so the Express app performs its normal routing.
 *
 * The implementation lives in `api/index.mjs` so the bare `/api` path and the
 * nested paths share one bootstrap and one Express instance.
 */
export { default } from './index.mjs';
