// Keep this import first — it sets MAX_UPLOAD_MB before src/config.ts loads.
import './helpers/upload-limit-env.js';

/**
 * End-to-end API tests running the REAL Express app on the Supabase-backed
 * store (fake Supabase client — no credentials, no network, no real data).
 *
 * These cover the migration-critical promises:
 *   • evidence metadata, analysis results and reports persist in PostgreSQL;
 *   • original uploaded bytes go to the private Storage bucket and are only
 *     reachable through an authenticated, organisation-scoped route;
 *   • a failed upload leaves neither an orphaned row nor an orphaned object;
 *   • one organisation can never read another organisation's data;
 *   • /api/health reports real database connectivity;
 *   • SOC 2 / ISO 27001 selection, gap analysis and PDF generation still work.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attachErrorHandling, createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { SupabaseStore } from '../src/store/supabase.js';
import { closeStore, setStoreForTesting } from '../src/store/index.js';
import { createFakeSupabase, type FakeSupabase } from './helpers/fake-supabase.js';
import type { SupabaseClient } from '../src/store/supabase-client.js';

const DEMO_EMAIL = 'demo@complylens.ai';
const DEMO_PASSWORD = 'DemoPass123!';

let fake: FakeSupabase;
let store: SupabaseStore;
let server: http.Server;
let base: string;
let token: string;

/** A tiny but realistic PDF with an extractable text layer. */
function pdfBytes(text: string): Buffer {
  return Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      'BT (' + text + ') Tj ET',
      'trailer << /Root 1 0 R >>',
      '%%EOF',
    ].join('\n'),
    'latin1',
  );
}

async function api(path: string, init: RequestInit = {}, authenticated = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (authenticated) headers.set('authorization', `Bearer ${token}`);
  return fetch(`${base}${path}`, { ...init, headers });
}

async function uploadEvidence(options: {
  fileName: string;
  bytes: Buffer;
  category?: string;
  frameworks?: string;
  authToken?: string;
}): Promise<Response> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(options.bytes)], { type: 'application/pdf' }),
    options.fileName,
  );
  if (options.category) form.append('category', options.category);
  if (options.frameworks) form.append('frameworks', options.frameworks);

  return fetch(`${base}/api/evidence`, {
    method: 'POST',
    headers: { authorization: `Bearer ${options.authToken ?? token}` },
    body: form,
  });
}

beforeAll(async () => {
  fake = createFakeSupabase();
  store = new SupabaseStore(fake.client as SupabaseClient);
  await store.init();
  setStoreForTesting(store);

  const app = createApp();
  attachErrorHandling(app);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  expect(login.status).toBe(200);
  token = ((await login.json()) as { token: string }).token;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeStore();
  setStoreForTesting(null);
});

/* -------------------------------------------------------------------------- */

describe('health endpoint', () => {
  it('reports the real store type and a verified database query', async () => {
    const response = await api('/api/health', {}, false);
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      status: string;
      store: { kind: string; persistent: boolean };
      database: { kind: string; connected: boolean; persistent: boolean; checkedAt: string; detail: string };
    };

    expect(payload.status).toBe('ok');
    expect(payload.store.kind).toBe('supabase');
    expect(payload.store.persistent).toBe(true);
    expect(payload.database.connected).toBe(true);
    expect(payload.database.persistent).toBe(true);
    expect(typeof payload.database.checkedAt).toBe('string');
  });

  it('reports degraded with 503 when the database query fails, and leaks nothing', async () => {
    fake.db.failWith = {
      message: 'getaddrinfo ENOTFOUND abcdefgh.supabase.co apikey=sb_secret_LEAKED password=hunter2',
      code: 'ENOTFOUND',
    };
    try {
      const response = await api('/api/health', {}, false);
      expect(response.status).toBe(503);

      const body = await response.text();
      expect(JSON.parse(body).status).toBe('degraded');
      expect(JSON.parse(body).database.connected).toBe(false);
      expect(body).not.toContain('sb_secret_LEAKED');
      expect(body).not.toContain('hunter2');
      expect(body).not.toContain('abcdefgh.supabase.co');
    } finally {
      fake.db.failWith = null;
    }
  });
});

describe('session and authorisation', () => {
  it('rejects an unauthenticated evidence request', async () => {
    const response = await api('/api/evidence', {}, false);
    expect(response.status).toBe(401);
  });

  it('rejects a wrong password without revealing which part failed', async () => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: DEMO_EMAIL, password: 'not-the-password' }),
    });
    expect(response.status).toBe(401);
    const payload = (await response.json()) as { error: { message: string } };
    expect(payload.error.message).toBe('Email or password is incorrect.');
  });

  it('rejects an expired session token', async () => {
    const { createSessionToken } = await import('../src/auth/tokens.js');
    const expired = createSessionToken(
      { sub: 'usr-demo-owner', email: DEMO_EMAIL, org: config.demo.organizationId, role: 'owner', demo: true },
      -1,
    );
    const response = await fetch(`${base}/api/evidence`, {
      headers: { authorization: `Bearer ${expired.token}` },
    });
    expect(response.status).toBe(401);
  });

  it('reports the Supabase store as the persistence mode in the session payload', async () => {
    const response = await api('/api/auth/session');
    const payload = (await response.json()) as { persistence: string };
    expect(payload.persistence).toBe('supabase');
  });
});

describe('evidence upload, storage and durability', () => {
  let uploadedId = '';

  it('stores the metadata in PostgreSQL and the bytes in the private bucket', async () => {
    const before = fake.db.rows('evidence').length;

    const response = await uploadEvidence({
      fileName: 'Encryption_Standard.pdf',
      bytes: pdfBytes('Data at rest is encrypted with AES-256 and keys are rotated annually.'),
      category: 'Data Protection',
      frameworks: 'soc2,iso27001',
    });

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      evidence: { id: string; fileName: string; originalFileAvailable: boolean; frameworkKeys: string[] };
    };
    uploadedId = payload.evidence.id;

    expect(payload.evidence.fileName).toBe('Encryption_Standard.pdf');
    expect(payload.evidence.frameworkKeys).toEqual(['soc2', 'iso27001']);
    expect(payload.evidence.originalFileAvailable).toBe(true);

    // A real relational row, not a document.
    expect(fake.db.rows('evidence')).toHaveLength(before + 1);
    const row = fake.db.rows('evidence').find((item) => item.id === uploadedId)!;
    expect(row.organization_id).toBe(config.demo.organizationId);
    expect(String(row.storage_path)).toMatch(
      /^org\/org_acmecloud\/ws\/ws_acmecloud_demo\/ev-[0-9a-f]{16}-[0-9a-f]{32}\.pdf$/,
    );

    // The bytes live in Storage; the row keeps only extracted text + metadata.
    expect(fake.storage.objects.size).toBe(1);
    const storedObject = [...fake.storage.objects.values()][0]!;
    expect(storedObject.bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(Object.keys(row)).not.toContain('file_bytes');
    expect(Object.keys(row)).not.toContain('data');
    expect(String(row.content).length).toBeLessThan(storedObject.bytes.length + 1024);
  });

  it('serves the original file only to the owning organisation', async () => {
    const response = await api(`/api/evidence/${uploadedId}/file`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('never exposes the storage path to the browser', async () => {
    const detail = await (await api(`/api/evidence/${uploadedId}`)).text();
    expect(detail).not.toContain('storagePath');
    expect(detail).not.toContain('storage_path');
    expect(detail).not.toContain('org/org_acmecloud/ws/');
  });

  it('keeps the uploaded document visible after a brand-new store instance boots', async () => {
    // Simulates a redeploy / new serverless instance: new store, new client,
    // same database + storage.
    const restarted = new SupabaseStore(
      createFakeSupabase(fake.db, fake.storage).client as SupabaseClient,
    );
    await restarted.init();

    const record = await restarted.getEvidence(uploadedId, config.demo.organizationId);
    expect(record).not.toBeNull();
    expect(record!.fileName).toBe('Encryption_Standard.pdf');
    // The analysis result survived too.
    expect(record!.summary.length).toBeGreaterThan(0);
    expect(['analyzed', 'needs_review']).toContain(record!.status);
  });

  it('lists, filters, patches and deletes the uploaded evidence', async () => {
    const list = (await (await api('/api/evidence')).json()) as { items: Array<{ id: string }> };
    expect(list.items.some((item) => item.id === uploadedId)).toBe(true);

    const filtered = (await (await api('/api/evidence?category=Data%20Protection')).json()) as {
      items: Array<{ id: string }>;
    };
    expect(filtered.items.some((item) => item.id === uploadedId)).toBe(true);

    const patched = await api(`/api/evidence/${uploadedId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ category: 'Access Control' }),
    });
    expect(patched.status).toBe(200);
    expect(((await patched.json()) as { evidence: { category: string } }).evidence.category).toBe(
      'Access Control',
    );

    const removed = await api(`/api/evidence/${uploadedId}`, { method: 'DELETE' });
    expect(removed.status).toBe(200);

    // Row gone AND object gone — no customer bytes left behind.
    expect(fake.db.rows('evidence').some((row) => row.id === uploadedId)).toBe(false);
    expect(fake.storage.objects.size).toBe(0);
    expect((await api(`/api/evidence/${uploadedId}/file`)).status).toBe(404);
  });
});

describe('upload validation and failure handling', () => {
  it('rejects an unsupported file type', async () => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), 'logo.png');
    const response = await fetch(`${base}/api/evidence`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    expect(response.status).toBe(415);
  });

  it('enforces the configured file size limit', async () => {
    expect(config.uploads.maxBytes).toBe(1024 * 1024);
    const response = await uploadEvidence({
      fileName: 'Huge_Policy.pdf',
      bytes: Buffer.alloc(config.uploads.maxBytes + 1024, 0x41),
    });
    expect(response.status).toBe(413);
    expect(fake.db.rows('evidence').some((row) => row.file_name === 'Huge_Policy.pdf')).toBe(false);
  });

  it('rejects an unknown category instead of silently storing it', async () => {
    const response = await uploadEvidence({
      fileName: 'Mystery.pdf',
      bytes: pdfBytes('x'),
      category: 'Totally Made Up',
    });
    expect(response.status).toBe(400);
    expect(fake.db.rows('evidence').some((row) => row.file_name === 'Mystery.pdf')).toBe(false);
  });

  it('leaves no orphaned row when the object store rejects the upload', async () => {
    const rowsBefore = fake.db.rows('evidence').length;
    fake.storage.failUploads = true;
    try {
      const response = await uploadEvidence({
        fileName: 'Storage_Down.pdf',
        bytes: pdfBytes('access reviews are performed quarterly'),
      });
      expect(response.status).toBe(500);
    } finally {
      fake.storage.failUploads = false;
    }
    expect(fake.db.rows('evidence')).toHaveLength(rowsBefore);
    expect(fake.db.rows('evidence').some((row) => row.file_name === 'Storage_Down.pdf')).toBe(false);
  });

  it('leaves no orphaned object when the metadata insert fails', async () => {
    const objectsBefore = fake.storage.objects.size;
    fake.db.missingTables.add('evidence');
    try {
      const response = await uploadEvidence({
        fileName: 'Db_Down.pdf',
        bytes: pdfBytes('incident response plan with severity levels'),
      });
      expect(response.status).toBe(500);
    } finally {
      fake.db.missingTables.delete('evidence');
    }
    expect(fake.storage.objects.size).toBe(objectsBefore);
  });
});

describe('organisation isolation across real accounts', () => {
  it('blocks cross-organisation reads of evidence, reports and files', async () => {
    const signup = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Outsider',
        email: 'outsider@example.com',
        password: 'OutsiderPass123!',
        organizationName: 'Outsider Inc',
        seedDemo: false,
      }),
    });
    expect(signup.status).toBe(201);
    const outsiderToken = ((await signup.json()) as { token: string }).token;

    // The demo org uploads a private document.
    const upload = await uploadEvidence({
      fileName: 'Private_Vendor_List.pdf',
      bytes: pdfBytes('vendor inventory and annual vendor review'),
      category: 'Vendor Management',
    });
    const privateId = ((await upload.json()) as { evidence: { id: string } }).evidence.id;

    const asOutsider = (path: string) =>
      fetch(`${base}${path}`, { headers: { authorization: `Bearer ${outsiderToken}` } });

    expect((await asOutsider(`/api/evidence/${privateId}`)).status).toBe(404);
    expect((await asOutsider(`/api/evidence/${privateId}/file`)).status).toBe(404);
    expect((await asOutsider(`/api/evidence/${privateId}/text`)).status).toBe(404);

    const outsiderList = (await (await asOutsider('/api/evidence')).json()) as { items: unknown[] };
    expect(outsiderList.items).toHaveLength(0);

    // And the owner still sees it.
    expect((await api(`/api/evidence/${privateId}`)).status).toBe(200);
    await api(`/api/evidence/${privateId}`, { method: 'DELETE' });
  });

  it('refuses to resolve a workspace from another organisation', async () => {
    const signup = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Second Outsider',
        email: 'outsider2@example.com',
        password: 'OutsiderPass123!',
        organizationName: 'Outsider Two',
        seedDemo: false,
      }),
    });
    const outsiderToken = ((await signup.json()) as { token: string }).token;

    const response = await fetch(
      `${base}/api/evidence?workspaceId=${encodeURIComponent(config.demo.workspaceId)}`,
      { headers: { authorization: `Bearer ${outsiderToken}` } },
    );
    expect(response.status).toBe(404);
  });
});

describe('frameworks, gaps and reports on PostgreSQL', () => {
  it('maps evidence to SOC 2 and ISO 27001 controls', async () => {
    const soc2 = (await (await api('/api/controls?framework=soc2')).json()) as {
      items: Array<{ code: string; status: string }>;
    };
    const iso = (await (await api('/api/controls?framework=iso27001')).json()) as {
      items: Array<{ code: string }>;
    };
    expect(soc2.items.length).toBe(28);
    expect(iso.items.length).toBe(22);
    expect(soc2.items.some((item) => item.status === 'passed')).toBe(true);
  });

  it('returns gap analysis with remediation guidance', async () => {
    const gaps = (await (await api('/api/gaps?framework=soc2')).json()) as {
      items: Array<{ controlCode: string; recommendation: { fix: string; owner: string; timelineLabel: string } }>;
    };
    expect(gaps.items.length).toBeGreaterThan(0);
    expect(gaps.items[0]!.recommendation.fix.length).toBeGreaterThan(0);
    expect(gaps.items[0]!.recommendation.owner.length).toBeGreaterThan(0);
  });

  it('generates a report, persists it in PostgreSQL and renders a real PDF', async () => {
    const created = await api('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ frameworkKey: 'iso27001' }),
    });
    expect(created.status).toBe(201);
    const { report } = (await created.json()) as { report: { id: string; frameworkKey: string } };
    expect(report.frameworkKey).toBe('iso27001');

    const row = fake.db.rows('reports').find((item) => item.id === report.id);
    expect(row).toBeTruthy();
    expect(row!.framework_key).toBe('iso27001');
    expect(typeof row!.summary).toBe('object');

    const pdf = await api(`/api/reports/${report.id}/pdf`);
    expect(pdf.status).toBe(200);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(10_000);
  });

  it('keeps the dashboard contract and the documented demo figures', async () => {
    const dashboard = (await (await api('/api/dashboard?framework=soc2')).json()) as {
      metric: { readinessIndex: number };
      counts: { total: number };
      organization: { name: string };
    };
    expect(dashboard.organization.name).toBe('AcmeCloud');
    expect(dashboard.counts.total).toBe(28);
    expect(typeof dashboard.metric.readinessIndex).toBe('number');
  });
});
