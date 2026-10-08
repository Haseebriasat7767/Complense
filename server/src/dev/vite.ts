/**
 * Development mode: mount the Vite dev server as Express middleware.
 *
 * One process, one port — the API and the web app are served from the same
 * origin in development and in production, so there is no CORS configuration
 * and no separate frontend URL to manage.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import type { Server } from 'node:http';
import { logger } from '../logger.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const clientRoot = path.resolve(serverRoot, '..', 'client');

export async function mountViteDevServer(app: Express, httpServer: Server): Promise<void> {
  const { createServer } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;
  const tailwind = (await import('@tailwindcss/vite')).default;

  const vite = await createServer({
    root: clientRoot,
    configFile: false,
    appType: 'custom',
    server: {
      middlewareMode: true,
      hmr: { server: httpServer },
      // The preview host is proxied by the platform, so accept any host header
      // in development. Production serves static files instead.
      allowedHosts: true,
    },
    plugins: [react(), tailwind()],
    resolve: {
      alias: { '@': path.resolve(clientRoot, 'src') },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'recharts', 'lucide-react'],
    },
  });

  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next();
      return;
    }
    try {
      const template = await vite.transformIndexHtml(
        req.originalUrl,
        await (await import('node:fs/promises')).readFile(
          path.resolve(clientRoot, 'index.html'),
          'utf-8',
        ),
      );
      res.status(200).setHeader('content-type', 'text/html').end(template);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });

  logger.info('Vite dev server mounted (middleware mode)');
}
