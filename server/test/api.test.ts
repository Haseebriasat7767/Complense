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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attachErrorHandling, createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { DEMO_WORKSPACE_LABEL } from '../src/domain/evidence-seed.js';
import { closeStore, initStore } from '../src/store/index.js';

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
  const payload = (await response.json()) as { token: string };
  token = payload.token;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeStore();
});

describe('health and metadata', () => {
  it('reports a healthy service without authentication', async () => {
    const response = await get('/api/health', false);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { status: string; store: { kind: string } };
    expect(payload.status).toBe('ok');
    expect(payload.store.kind).toBe('memory');
  });

  it('seeds the requested AcmeCloud organization and workspace labels', async () => {
    const payload = (await (await get('/api/context')).json()) as {
      organization: { name: string };
      workspace: { name: string; isDemo: boolean };
    };
    expect(config.demo.organizationName).toBe('AcmeCloud');
    expect(config.demo.workspaceName).toBe(DEMO_WORKSPACE_LABEL);
    expect(payload.organization.name).toBe('AcmeCloud');
    expect(payload.workspace.name).toBe('AcmeCloud Demo Workspace');
    expect(payload.workspace.isDemo).toBe(true);
  });

  it('publishes the analysis mode so the UI can disclose it', async () => {
    const payload = (await (await get('/api/meta', false)).json()) as { analysis: { mode: string; label: string } };
    expect(payload.analysis.mode).toBe('demo-analysis');
    expect(payload.analysis.label).toContain('Demo Analysis Mode');
  });

  it('does not trust a client-supplied forwarded IP by default', async () => {
    const requestIp = async (forwardedFor?: string) => {
      const response = await fetch(`${base}/__test/client-ip`, {
        headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
      });
      return ((await response.json()) as { ip: string }).ip;
    };
    expect(await requestIp('203.0.113.99')).toBe(await requestIp());
  });
});

describe('authentication', () => {
  it('rejects a wrong password with a safe message', async () => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'demo@complylens.ai', password: 'not-the-password' }),
    });
    expect(response.status).toBe(401);
    const payload = (await response.json()) as { error: { message: string } };
    expect(payload.error.message).toBe('Email or password is incorrect.');
  });

  it('refuses protected routes without a token', async () => {
    const response = await get('/api/dashboard', false);
    expect(response.status).toBe(401);
  });

  it('does not accept bearer tokens in query strings', async () => {
    const response = await fetch(`${base}/api/dashboard?access_token=${encodeURIComponent(token)}`);
    expect(response.status).toBe(401);
  });

  it('issues an instant demo session', async () => {
    const response = await fetch(`${base}/api/auth/demo`, { method: 'POST' });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { user: { isDemoUser: boolean }; workspace: { isDemo: boolean } };
    expect(payload.user.isDemoUser).toBe(true);
    expect(payload.workspace.isDemo).toBe(true);
  });

  it('answers a malformed session token with 401, never a server error', async () => {
    // Regression: a non-JSON base64url header used to surface as an unhandled
    // SyntaxError (HTTP 500). A corrupt or tampered token must be a 401 so the
    // client signs the user in again instead of showing a failure screen.
    for (const candidate of ['not.a.token', 'x.y.z', 'header.payload', 'a.b.c.d', '']) {
      const response = await fetch(`${base}/api/dashboard`, {
        headers: { authorization: `Bearer ${candidate}` },
      });
      expect(response.status, `token ${JSON.stringify(candidate)}`).toBe(401);
      const payload = (await response.json()) as { error: { code: string } };
      expect(payload.error.code).toBe('unauthorized');
    }
  });

  it('rejects a token with a tampered signature', async () => {
    const [header, payload] = token.split('.');
    const response = await fetch(`${base}/api/dashboard`, {
      headers: { authorization: `Bearer ${header}.${payload}.not-the-signature` },
    });
    expect(response.status).toBe(401);
  });

  it('cannot be used to enumerate accounts through password reset', async () => {
    const request = (email: string) =>
      fetch(`${base}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

    const known = await request('demo@complylens.ai');
    const unknown = await request('nobody-here@example.com');

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    // Identical responses: no field may reveal whether the address exists.
    expect(unknown.body).toEqual(known.body);
    // Pin the response shape so re-introducing an "accountFound" style field
    // (or any other enumeration signal) fails this test.
    expect(Object.keys(known.body as Record<string, unknown>).sort()).toEqual([
      'emailDeliveryEnabled',
      'message',
      'ok',
    ]);
  });
});

describe('readiness workspace', () => {
  it('returns the documented demo dashboard numbers', async () => {
    const payload = (await (await get('/api/dashboard')).json()) as {
      metric: { readinessIndex: number };
      counts: { total: number; passed: number; needsAttention: number; missing: number };
      findings: { critical: number; total: number };
      priorityFindings: Array<{ controlCode: string }>;
    };
    expect(payload.metric.readinessIndex).toBe(92);
    expect(payload.counts).toMatchObject({ total: 28, passed: 18, needsAttention: 4, missing: 2 });
    expect(payload.findings.total).toBe(10);
    expect(payload.findings.critical).toBe(2);
    expect(payload.priorityFindings.length).toBeGreaterThanOrEqual(3);
  });

  it('explains a partially covered control end to end', async () => {
    const payload = (await (await get('/api/controls/SOC2-CC6.1')).json()) as {
      control: { code: string; status: string; riskLevel: string };
      requirements: Array<{ label: string; satisfied: boolean }>;
      recommendation: { fix: string; owner: string; timelineDays: number };
    };
    expect(payload.control.status).toBe('needs_attention');
    expect(payload.control.riskLevel).toBe('high');
    expect(payload.requirements.some((requirement) => !requirement.satisfied)).toBe(true);
    expect(payload.recommendation.owner.length).toBeGreaterThan(0);
    expect(payload.recommendation.timelineDays).toBe(30);
  });

  it('filters the gap list by risk level', async () => {
    const payload = (await (await get('/api/gaps?risk=critical')).json()) as {
      items: Array<{ riskLevel: string }>;
      ratings: { critical: number };
    };
    expect(payload.items.length).toBeGreaterThan(0);
    expect(payload.items.every((finding) => finding.riskLevel === 'critical')).toBe(true);
    expect(payload.ratings.critical).toBe(payload.items.length);
  });

  it('reports both framework readiness indexes', async () => {
    const payload = (await (await get('/api/readiness')).json()) as {
      items: Array<{ key: string; readinessIndex: number }>;
    };
    const indexes = Object.fromEntries(payload.items.map((item) => [item.key, item.readinessIndex]));
    expect(indexes).toEqual({ soc2: 92, iso27001: 78 });
  });
});

describe('reports', () => {
  it('exposes the actual control count for each framework', async () => {
    const payload = (await (await get('/api/reports')).json()) as {
      frameworks: Array<{ key: string; controlCount: number }>;
    };
    expect(Object.fromEntries(payload.frameworks.map((item) => [item.key, item.controlCount]))).toEqual({
      soc2: 28,
      iso27001: 22,
    });
  });

  it('generates a report and streams a real PDF', async () => {
    const created = await fetch(`${base}/api/reports`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ frameworkKey: 'soc2' }),
    });
    expect(created.status).toBe(201);
    const { report } = (await created.json()) as {
      report: {
        id: string;
        scoreIndex: number;
        summary: {
          controlsByStatus: {
            passed: unknown[];
            needsAttention: unknown[];
            missing: unknown[];
            needsReview: unknown[];
          };
          disclaimer: string;
        };
      };
    };
    expect(report.scoreIndex).toBe(92);

    // The report carries the per-status control lists used by PDF sections 4-7.
    expect(report.summary.controlsByStatus.passed.length).toBe(18);
    expect(report.summary.controlsByStatus.needsAttention.length).toBe(4);
    expect(report.summary.controlsByStatus.missing.length).toBe(2);
    expect(report.summary.controlsByStatus.needsReview.length).toBe(4);
    expect(report.summary.disclaimer).toContain(
      'This report is an AI-generated preliminary readiness assessment. It is not a certification, audit opinion, or substitute for professional compliance advice.',
    );

    const pdf = await fetch(`${base}/api/reports/${report.id}/pdf`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    const buffer = Buffer.from(await pdf.arrayBuffer());
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.byteLength).toBeGreaterThan(10_000);
  });
});

describe('input validation', () => {
  it('returns a structured client error for malformed JSON', async () => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'invalid_json', message: 'Request body must contain valid JSON.' },
    });
  });

  it('does not promote failed or review-needed evidence during re-analysis', async () => {
    const failed = await fetch(`${base}/api/evidence/ev-demo-legacy-data-flow-diagram/analyze`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(failed.status).toBe(200);
    expect(((await failed.json()) as { evidence: { status: string } }).evidence.status).toBe('failed');

    const review = await fetch(`${base}/api/evidence/ev-demo-vendor-questionnaire-q3/analyze`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(review.status).toBe(200);
    expect(((await review.json()) as { evidence: { status: string } }).evidence.status).toBe('needs_review');
  });

  it('does not allow clients to set extraction status directly', async () => {
    const response = await fetch(`${base}/api/evidence/ev-demo-legacy-data-flow-diagram`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'analyzed' }),
    });
    expect(response.status).toBe(400);
  });

  it('maps an upload only to the framework selected for that document', async () => {
    const form = new FormData();
    form.append(
      'file',
      new Blob(['Access control policy. Quarterly access review and access provisioning records.'], {
        type: 'text/plain',
      }),
      'Framework_Specific_Evidence.txt',
    );
    form.append('frameworks', 'soc2');

    const uploaded = await fetch(`${base}/api/evidence`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    expect(uploaded.status).toBe(201);
    const { evidence } = (await uploaded.json()) as { evidence: { id: string; frameworkKeys: string[] } };
    expect(evidence.frameworkKeys).toEqual(['soc2']);

    const detail = (await (await get(`/api/evidence/${evidence.id}`)).json()) as {
      mapping: Array<{ frameworkKey: string }>;
    };
    expect(detail.mapping.length).toBeGreaterThan(0);
    expect(detail.mapping.every((entry) => entry.frameworkKey === 'soc2')).toBe(true);
  });

  it('rejects an unsupported upload type with a helpful message', async () => {
    const form = new FormData();
    form.append('file', new Blob(['not a supported document'], { type: 'application/zip' }), 'archive.zip');
    const response = await fetch(`${base}/api/evidence`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    // 415 = unsupported media type; the message lists the formats we do accept.
    expect(response.status).toBe(415);
    const payload = (await response.json()) as { error: { message: string } };
    expect(payload.error.message.toLowerCase()).toContain('pdf');
  });

  it('returns a structured 404 for unknown API routes', async () => {
    const response = await get('/api/not-a-route');
    expect(response.status).toBe(404);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe('not_found');
  });
});
