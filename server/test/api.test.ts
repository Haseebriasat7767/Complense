/**
 * HTTP integration tests.
 *
 * Boots the real Express app (in-memory store, no external services) on an
 * ephemeral port and exercises the demo journey the product promises: sign in,
 * read the dashboard, inspect a partially covered control, list findings,
 * generate a readiness report and download the PDF.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { attachErrorHandling, createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { DEMO_WORKSPACE_LABEL } from '../src/domain/evidence-seed.js';
import { closeStore, initStore } from '../src/store/index.js';

// Keep HTTP integration tests isolated from Supabase Storage. The production
// service is exercised in buyer acceptance tests against a real private bucket.
vi.mock('../src/services/original-files.js', () => ({
  uploadOriginalFile: vi.fn().mockResolvedValue(undefined),
  downloadOriginalFile: vi.fn(),
  deleteOriginalFile: vi.fn().mockResolvedValue(undefined),
}));

let server: http.Server;
let base: string;
let token: string;

async function get(path: string, authenticated = true): Promise<Response> {
  return fetch(`${base}${path}`, {
    headers: authenticated ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeAll(async () => {
  await initStore();
  const app = createApp();
  app.get('/__test/client-ip', (req, res) => res.json({ ip: req.ip }));
  attachErrorHandling(app);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;

  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@complylens.ai', password: 'DemoPass123!' }),
  });
  expect(response.status).toBe(200);
  const payload = (await ...[truncated]