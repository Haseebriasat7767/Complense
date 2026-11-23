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
  const payload = (await response.json()) as {
    token: string;
    user: { email: string; name: string };
    organization: { name: string };
    workspace: { name: string } | null;
  };
  expect(typeof payload.token).toBe('string');
  expect(payload.token.split('.')).toHaveLength(3);
  expect(payload.user.email).toBe('demo@complylens.ai');
  expect(payload.organization.name).toBe('AcmeCloud');
  token = payload.token;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeStore();
});

describe('demo journey over HTTP', () => {
  it('reads the dashboard for the seeded demo workspace', async () => {
    const response = await get('/api/dashboard');
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      organization: { name: string };
      workspace: { name: string };
      framework: { key: string };
      metric: { readinessIndex: number; bandLabel: string };
      counts: { reviewed: number; passed: number; needsAttention: number; missing: number };
    };
    expect(payload.organization.name).toBe('AcmeCloud');
    expect(payload.workspace.name).toBe(DEMO_WORKSPACE_LABEL);
    expect(payload.framework.key).toBe('soc2');
    // Real engine values for the seeded demo corpus (see demo-workspace.test.ts):
    // SOC 2 index 77, Moderate readiness, 23 reviewed / 18 passed / 4 needs
    // attention / 1 missing. The 94/84 figures in older docs are stale.
    expect(payload.metric.readinessIndex).toBe(77);
    expect(payload.metric.bandLabel).toBe('Moderate readiness');
    expect(payload.counts.reviewed).toBe(23);
    expect(payload.counts.passed).toBe(18);
    expect(payload.counts.needsAttention).toBe(4);
    expect(payload.counts.missing).toBe(1);
  });

  it('inspects a partially covered control', async () => {
    const response = await get('/api/controls/SOC2-CC6.1');
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      control: { code: string; status: string; statusLabel: string };
      requirements: Array<{ label: string; satisfied: boolean }>;
      evidenceMissing: string[];
      evidenceFound: unknown[];
    };
    expect(payload.control.code).toBe('SOC2-CC6.1');
    expect(payload.control.status).toBe('needs_attention');
    expect(payload.requirements.length).toBeGreaterThan(0);
    // Partially covered: some requirements satisfied, some still missing.
    expect(payload.requirements.some((item) => item.satisfied)).toBe(true);
    expect(payload.requirements.some((item) => !item.satisfied)).toBe(true);
    expect(payload.evidenceMissing.length).toBeGreaterThan(0);
    expect(payload.evidenceFound.length).toBeGreaterThan(0);
  });

  it('lists findings, including the missing change-management control', async () => {
    const response = await get('/api/gaps?framework=soc2');
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      items: Array<{ controlCode: string; controlStatus: string }>;
      total: number;
    };
    expect(payload.total).toBeGreaterThan(0);
    expect(payload.items.length).toBe(payload.total);
    const codes = payload.items.map((item) => item.controlCode);
    expect(codes).toContain('SOC2-CC8.1');
    const changeManagement = payload.items.find((item) => item.controlCode === 'SOC2-CC8.1');
    expect(changeManagement?.controlStatus).toBe('missing');
  });

  it('generates a readiness report and downloads the PDF', async () => {
    const created = await fetch(`${base}/api/reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ frameworkKey: 'soc2' }),
    });
    expect(created.status).toBe(201);
    const createdPayload = (await created.json()) as {
      report: { id: string; frameworkKey: string; scoreIndex: number; downloadUrl: string };
    };
    expect(createdPayload.report.frameworkKey).toBe('soc2');
    expect(createdPayload.report.scoreIndex).toBe(77);
    expect(createdPayload.report.downloadUrl).toBe(`/api/reports/${createdPayload.report.id}/pdf`);

    const pdf = await get(`/api/reports/${createdPayload.report.id}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toContain('application/pdf');
    const bytes = await pdf.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('rejects unauthenticated dashboard access with 401', async () => {
    const response = await get('/api/dashboard', false);
    expect(response.status).toBe(401);
  });
});
