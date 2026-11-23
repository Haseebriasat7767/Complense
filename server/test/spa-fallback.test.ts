/**
 * SPA fallback contract — the Vercel 404-on-refresh guard.
 *
 * In production the client is served by a separate Vercel service (see the
 * root vercel.json). That service must rewrite every non-file URL to
 * /index.html so client-side routes (/app/dashboard, /demo, /pricing …)
 * load on direct navigation and refresh instead of returning Vercel 404.
 * Vercel checks the filesystem before rewrites, so hashed /assets/* files
 * still serve directly.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('SPA fallback', () => {
  it('the client service has a catch-all rewrite to /index.html', () => {
    const clientVercel = path.join(repoRoot, 'client', 'vercel.json');
    expect(existsSync(clientVercel)).toBe(true);
    const config = JSON.parse(readFileSync(clientVercel, 'utf8')) as {
      rewrites?: Array<{ source: string; destination: string }>;
    };
    expect(config.rewrites ?? []).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });

  it('the root routing keeps /api/* on the server service, not the SPA', () => {
    const rootVercel = JSON.parse(readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8')) as {
      rewrites?: Array<{ source: string; destination: unknown }>;
    };
    const apiRewrite = (rootVercel.rewrites ?? []).find((rule) => rule.source === '/api/(.*)');
    expect(apiRewrite).toBeDefined();
    expect(JSON.stringify(apiRewrite?.destination)).toContain('server-next-release');
  });
});
