/**
 * ComplyLens AI — server entry point.
 *
 * One process serves the API and the web application:
 *   development : Express + Vite middleware (HMR on the same port)
 *   production  : Express + prebuilt client from client/dist
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { attachErrorHandling, createApp, serveStatic } from './app.js';
import { analysisMode, config } from './config.js';
import { logger } from './logger.js';
import { closeStore, initStore } from './store/index.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = path.resolve(serverRoot, '..', 'client');
const clientDist = path.resolve(clientRoot, 'dist');

async function main(): Promise<void> {
  const store = await initStore();
  const app = createApp();
  const server = http.createServer(app);

  const isDev = !config.isProduction;
  const clientEntryExists = existsSync(path.resolve(clientRoot, 'index.html'));

  if (isDev && clientEntryExists) {
    const { mountViteDevServer } = await import('./dev/vite.js');
    await mountViteDevServer(app, server);
  } else if (!serveStatic(app, clientDist)) {
    logger.warn(`No client build found at ${clientDist}. Run "npm run build" first, or start in development mode.`);
    app.get('/', (_req, res) => {
      res
        .status(200)
        .type('text/plain')
        .send('ComplyLens AI API is running. Build the client with "npm run build" to serve the web app.');
    });
  }

  // Error handling is registered last so it also covers static/Vite failures.
  attachErrorHandling(app);

  server.listen(config.port, config.host, () => {
    const url = `http://localhost:${config.port}`;
    logger.info(`ComplyLens AI ready on ${url}`, {
      mode: config.isProduction ? 'production' : 'development',
      store: store.kind,
      analysis: analysisMode(),
      demoMode: config.demoMode,
      authRequired: config.authRequired,
    });
    if (!config.isProduction) {
      logger.info(`Open ${url} — the API is served from the same origin at /api`);
    }
    if (config.session.secretIsEphemeral && config.isProduction) {
      logger.warn('SESSION_SECRET is not set — sessions will be invalidated on every restart.');
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}. Shutting down.`);
    server.close(() => {
      void closeStore().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

main().catch((error) => {
  logger.error('Failed to start ComplyLens AI', {
    reason: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
