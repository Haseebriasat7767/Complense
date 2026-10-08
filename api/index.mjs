/**
 * Vercel serverless entry point (Option C deployment — see docs/DEPLOYMENT.md).
 *
 * Vercel serves the prebuilt web client from `client/dist` and routes every
 * `/api/*` request to this single function. The function re-uses the existing
 * Express application from `server/dist` unchanged — the same routers,
 * middleware, validation, store and PDF renderer that run in the container
 * deployment. No route is re-implemented for the platform.
 *
 * Why a single catch-all function instead of one file per endpoint: the Express
 * app already owns routing, authentication and organisation scoping. Splitting
 * it into many serverless handlers would duplicate that logic and risk the API
 * drifting from the CLI/Docker deployment.
 *
 * Cold starts: each instance initialises the store once (MongoDB when
 * MONGODB_URI is set and reachable, otherwise the deterministic in-memory demo
 * store). State is per instance — set MONGODB_URI for persistence.
 *
 * This file is plain JavaScript on purpose: it imports the compiled server so
 * Vercel does not need to transpile the project's NodeNext TypeScript.
 */
import { attachErrorHandling, createApp } from '../server/dist/app.js';
import { initStore } from '../server/dist/store/index.js';

/** @type {Promise<import('express').Express> | null} */
let appPromise = null;

async function bootstrap() {
  await initStore(); // seeds the labelled demo workspace on a cold start
  const app = createApp();
  attachErrorHandling(app);
  return app;
}

/** @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res */
export default async function handler(req, res) {
  // Boot once per instance; retry on failure so one bad cold start is not fatal.
  appPromise ??= bootstrap().catch((error) => {
    appPromise = null;
    throw error;
  });
  const app = await appPromise;
  app(req, res);
}
