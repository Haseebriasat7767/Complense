/**
 * SPA fallback contract — the Vercel 404-on-refresh guard.
 *
 * In production the client is served by a separate Vercel service (see the
 * root vercel.json). That service must rewrite every non-file URL to
 * /index.html so client-side routes (/app/dashboard, /demo, /pricing …)
 * load on direct navigation and refresh instead of returning Vercel 404.
 * Vercel checks the filesystem before rewrites, so hashed /assets/* files
 * still serve directly.
 *
 * Lesson learned 2026-11-24: a standalone client/vercel.json is IGNORED in
 * the Vercel Services model — the service's config comes from the root
 * vercel.json `services.client` object. The catch-all MUST live there as a
 * service-scoped rewrite; the client/vercel.json copy is kept only as a
 * harmless duplicate for non-services contexts.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

type Rewrite = { source: string; destination: string | Record<string, unknown> };

function readJson(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(repoRoot, relative), 'utf8')) as Record<string, unknown>;
}

describe('SPA fallback', () => {
  it('the client service has a service-scoped catch-all rewrite to /index.html in the ROOT vercel.json', () => {
    const root = readJson('vercel.json');
    const services = root.services as Record<string, { rewrites?: Rewrite[] }>;
    expect(services).toBeDefined();
    expect(services.client).toBeDefined();
    expect(services.client.rewrites ?? []).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });

  it('the standalone client/vercel.json still carries the same rule as a fallback', () => {
    const clientVercel = path.join(repoRoot, 'client', 'vercel.json');
    expect(existsSync(clientVercel)).toBe(true);
    const config = readJson('client/vercel.json') as { rewrites?: Rewrite[] };
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
