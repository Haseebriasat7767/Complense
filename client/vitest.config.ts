import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Unit/integration tests for client-side auth state (client/src/lib/session.tsx,
 * client/src/lib/api.ts). Kept separate from vite.config.ts so the production
 * build config never has to know about the test runner.
 */
export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(root, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: [path.resolve(root, 'src/test/setup.ts')],
    css: false,
  },
});
