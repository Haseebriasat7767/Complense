/**
 * Express application assembly.
 *
 * Route modules are mounted under /api. In production the built client in
 * `client/dist` is served from the same origin; in development the Vite dev
 * server is mounted as middleware (see src/dev/vite.ts). The SPA fallback keeps
 * client-side routes working on refresh.
 */
import express, { type Express } from 'express';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { corsHeaders, rateLimit, securityHeaders } from './http/security.js';
import { authRouter } from './routes/auth.js';
import { controlsRouter } from './routes/controls.js';
import { evidenceRouter } from './routes/evidence.js';
import { frameworksRouter } from './routes/frameworks.js';
import { gapsRouter } from './routes/gaps.js';
import { metaRouter } from './routes/meta.js';
import { reportsRouter } from './routes/reports.js';
import { workspaceRouter } from './routes/workspace.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops);
  app.use(securityHeaders());
  app.use(corsHeaders());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    rateLimit({
      name: 'api',
      windowMs: 60 * 1000,
      max: 600,
      message: 'Too many requests. Please retry in a moment.',
    }),
  );

  app.use('/api', metaRouter);
  app.use('/api/auth', authRouter);
  app.use('/api', workspaceRouter);
  // Mounted under its own prefix so evidence ids cannot shadow other routes.
  app.use('/api/evidence', evidenceRouter);
  app.use('/api', controlsRouter);
  app.use('/api', gapsRouter);
  app.use('/api', reportsRouter);
  app.use('/api', frameworksRouter);

  // Unknown API routes must not fall through to the SPA shell.
  app.use('/api', notFoundHandler);

  return app;
}

/** Terminal error handler — must be registered after static/history fallbacks. */
export function attachErrorHandling(app: Express): void {
  app.use(errorHandler);
}

export function serveStatic(app: Express, clientDist: string): boolean {
  if (!config.isProduction) return false;
  try {
    app.use(
      express.static(clientDist, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) res.setHeader('cache-control', 'no-store');
          if (filePath.includes('/assets/')) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: clientDist });
    });
    return true;
  } catch {
    return false;
  }
}
