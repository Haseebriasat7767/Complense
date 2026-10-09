/**
 * SupabaseStore unit/integration tests.
 *
 * These run the REAL store implementation (filters, ordering, row mapping,
 * organisation scoping, seeding, compensation) against the in-process fake
 * Supabase client in `test/helpers/fake-supabase.ts`. No credentials, no
 * network, and no chance of touching real customer data.
 *
 * Live-project verification is a separate, documented manual step
 * (README → "Verify the Supabase deployment").
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { SupabaseStore } from '../src/store/supabase.js';
import { config } from '../src/config.js';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';
import { DEMO_CREDENTIALS } from '../src/store/seed.js';
import {
  createFakeSupabase,
  FakeDatabase,
  type FakeSupabase,
} from './helpers/fake-supabase.js';
import type { Organization, ReportRecord, User, Workspace } from '../src/domain/types.js';
import type { SupabaseClient } from '../src/store/supabase-client.js';

let fake: FakeSupabase;
let store: SupabaseStore;

function newStore(target: FakeSupabase): SupabaseStore {
  return new SupabaseStore(target.client as SupabaseClient);
}

beforeEach(() => {
  fake = createFakeSupabase();
  store = newStore(fake);
});

function organization(id: string, name: string): Organization {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    plan: 'starter',
    primaryFramework: 'soc2',
    industry: 'SaaS',
    employeeCount: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    settings: {
      defaultFramework: 'soc2',
      monthlyDigest: true,
      gapAlerts: true,
      reportReadyEmails: true,
      uploadNotifications: true,
      mfaRequired: false,
      sessionTimeoutMinutes: 60,
      allowedUploadTypes: ['pdf'],
      retentionDays: 365,
    },
  };
}

function workspace(id: string, organizationId: string): Workspace {
  return {
    id,
    organizationId,
    name: 'Compliance Workspace',
    isDemo: false,
    isDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ownerUserId: `usr-${organizationId}`,
  };
}

async function user(id: string, organizationId: string, email: string): Promise<User> {
  return {
    id,
    organizationId,
    email,
    name: 'Test User',
    jobTitle: 'Security Owner',
    role: 'owner',
    isDemoUser: false,
    passwordHash: await hashPassword('CorrectHorse123!'),
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

async function seedTenant(id: string, email: string) {
  const org = organization(id, id);
  const ws = workspace(`ws-${id}`, id);
  const usr = await user(`usr-${id}`, id, email);
  await store.createAccount({ organization: org, workspace: ws, user: usr });
  return { org, ws, usr };
}

/* -------------------------------------------------------------------------- */

describe('startup and schema', () => {
  it('initialises against a correctly migrated project and seeds the demo workspace', async () => {
    await store.init();

    expect(fake.db.rows('organizations').map((row) => row.id)).toContain(config.demo.organizationId);
    expect(fake.db.rows('workspaces').map((row) => row.id)).toContain(config.demo.workspaceId);
    expect(fake.db.rows('users')).toHaveLength(2);
    expect(fake.db.rows('evidence')).toHaveLength(10);
  });

  it('fails with an actionable error when the migrations were never applied', async () => {
    fake.db.missingTables.add('organizations');
    await expect(store.init()).rejects.toThrow(/schema is missing from this Supabase project/i);
  });

  it('fails (never silently degrades) when the database is unreachable', async () => {
    fake.db.failWith = { message: 'fetch failed', code: 'ECONNREFUSED' };
    await expect(store.init()).rejects.toThrow(/unreachable/i);
  });

  it('writes relational rows with snake_case columns, not Mongo documents', async () => {
    await store.init();
    const row = fake.db.rows('evidence')[0] as Record<string, unknown>;
    expect(row).toHaveProperty('organization_id');
    expect(row).toHaveProperty('workspace_id');
    expect(row).toHaveProperty('framework_keys');
    expect(row).not.toHaveProperty('_id');
    expect(row).not.toHaveProperty('organizationId');
  });
});

describe('demo seed idempotency', () => {
  it('does not duplicate demo rows across repeated cold starts', async () => {
    await store.init();
    const counts = {
      organizations: fake.db.rows('organizations').length,
      workspaces: fake.db.rows('workspaces').length,
      users: fake.db.rows('users').length,
      evidence: fake.db.rows('evidence').length,
    };

    // Three more cold starts, each with a brand-new store instance.
    for (let i = 0; i < 3; i += 1) await newStore(fake).init();

    expect(fake.db.rows('organizations')).toHaveLength(counts.organizations);
    expect(fake.db.rows('workspaces')).toHaveLength(counts.workspaces);
    expect(fake.db.rows('users')).toHaveLength(counts.users);
    expect(fake.db.rows('evidence')).toHaveLength(counts.evidence);
  });

  it('never overwrites edited demo records on a later boot', async () => {
    await store.init();
    await store.updateEvidence(
      String(fake.db.rows('evidence')[0]!.id),
      config.demo.organizationId,
      { summary: 'Edited by the customer' },
    );

    await newStore(fake).init();

    const edited = fake.db
      .rows('evidence')
      .find((row) => row.summary === 'Edited by the customer');
    expect(edited).toBeTruthy();
  });

  it('never touches an unrelated customer organisation', async () => {
    await seedTenant('org-real', 'real@example.com');
    await store.init();
    await newStore(fake).init();

    const real = fake.db.rows('organizations').filter((row) => row.id === 'org-real');
    expect(real).toHaveLength(1);
    expect(real[0]!.name).toBe('org-real');
  });
});

describe('passwords and sessions', () => {
  it('stores a scrypt digest, never the password, and verifies it after a round trip', async () => {
    const { usr } = await seedTenant('org-pw', 'pw@example.com');

    const row = fake.db.rows('users').find((item) => item.id === usr.id)!;
    expect(String(row.password_hash)).toMatch(/^scrypt\$/);
    expect(JSON.stringify(row)).not.toContain('CorrectHorse123!');

    const loaded = await store.getUserByEmail('pw@example.com');
    expect(loaded).not.toBeNull();
    expect(await verifyPassword('CorrectHorse123!', loaded!.passwordHash)).toBe(true);
    expect(await verifyPassword('wrong-password', loaded!.passwordHash)).toBe(false);
  });

  it('matches the login email case-insensitively and rejects a duplicate address', async () => {
    await seedTenant('org-case', 'Mixed.Case@Example.com');
    expect(await store.getUserByEmail('mixed.case@example.com')).not.toBeNull();
    expect(await store.getUserByEmail('MIXED.CASE@EXAMPLE.COM')).not.toBeNull();

    await expect(seedTenant('org-case-2', 'MIXED.CASE@example.com')).rejects.toThrow(/unique|duplicate/i);
  });

  it('records the last login timestamp as a normalised ISO string', async () => {
    const { usr } = await seedTenant('org-login', 'login@example.com');
    await store.touchLastLogin(usr.id);
    const loaded = await store.getUserById(usr.id);
    expect(loaded?.lastLoginAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('seeds demo users with usable, hashed demo credentials', async () => {
    await store.init();
    const owner = await store.getUserByEmail(DEMO_CREDENTIALS.email);
    expect(owner).not.toBeNull();
    expect(await verifyPassword(DEMO_CREDENTIALS.password, owner!.passwordHash)).toBe(true);
  });
});

describe('organisation and workspace isolation', () => {
  it('never returns another organisation\'s evidence', async () => {
    const a = await seedTenant('org-a', 'a@example.com');
    const b = await seedTenant('org-b', 'b@example.com');

    const secret = await store.createEvidence({
      organizationId: a.org.id,
      workspaceId: a.ws.id,
      fileName: 'A_Secret.pdf',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      category: 'Access Control',
      source: 'upload',
      uploadedAt: '2026-02-01T00:00:00.000Z',
      uploadedBy: 'a@example.com',
      status: 'analyzed',
      frameworkKeys: ['soc2'],
      content: 'secret',
      summary: 'secret',
    });

    expect(await store.getEvidence(secret.id, b.org.id)).toBeNull();
    expect(await store.listEvidence(b.org.id, b.ws.id)).toHaveLength(0);
    expect(await store.listEvidence(b.org.id, a.ws.id)).toHaveLength(0);
    expect(await store.updateEvidence(secret.id, b.org.id, { summary: 'hacked' })).toBeNull();
    expect(await store.deleteEvidence(secret.id, b.org.id)).toBe(false);

    // Still intact for its real owner.
    expect(await store.getEvidence(secret.id, a.org.id)).not.toBeNull();
  });

  it('scopes reports and workspaces to the owning organisation', async () => {
    const a = await seedTenant('org-r1', 'r1@example.com');
    const b = await seedTenant('org-r2', 'r2@example.com');

    const report: ReportRecord = {
      id: 'rpt-isolation',
      organizationId: a.org.id,
      workspaceId: a.ws.id,
      name: 'SOC 2 readiness',
      frameworkKey: 'soc2',
      companyName: 'A',
      fileName: 'a.pdf',
      generatedAt: '2026-02-02T00:00:00.000Z',
      status: 'ready',
      scoreIndex: 80,
      summary: {} as ReportRecord['summary'],
      requestedBy: 'a@example.com',
    };
    await store.createReport(report);

    expect(await store.getReport(report.id, b.org.id)).toBeNull();
    expect(await store.listReports(b.org.id, b.ws.id)).toHaveLength(0);
    expect(await store.deleteReport(report.id, b.org.id)).toBe(false);
    expect((await store.listWorkspaces(b.org.id)).map((item) => item.id)).toEqual([b.ws.id]);
  });

  it('keeps the audit trail organisation-scoped', async () => {
    await seedTenant('org-aud1', 'aud1@example.com');
    await seedTenant('org-aud2', 'aud2@example.com');
    await store.recordAuditEvent({
      organizationId: 'org-aud1',
      actor: 'aud1@example.com',
      action: 'evidence.uploaded',
      target: 'x.pdf',
      at: '2026-03-01T00:00:00.000Z',
    });

    expect(await store.listAuditEvents('org-aud1', 10)).toHaveLength(1);
    expect(await store.listAuditEvents('org-aud2', 10)).toHaveLength(0);
  });

  it('rolls back a partially created account instead of leaving an orphan organisation', async () => {
    await seedTenant('org-dupe', 'dupe@example.com');

    // Same email, different organisation → the user insert fails.
    const org = organization('org-dupe-2', 'org-dupe-2');
    const ws = workspace('ws-dupe-2', 'org-dupe-2');
    const usr = await user('usr-dupe-2', 'org-dupe-2', 'dupe@example.com');

    await expect(store.createAccount({ organization: org, workspace: ws, user: usr })).rejects.toThrow();

    expect(fake.db.rows('organizations').some((row) => row.id === 'org-dupe-2')).toBe(false);
    expect(fake.db.rows('workspaces').some((row) => row.id === 'ws-dupe-2')).toBe(false);
  });
});

describe('evidence CRUD and durability', () => {
  it('creates, lists, reads, updates and deletes evidence', async () => {
    const a = await seedTenant('org-crud', 'crud@example.com');

    const created = await store.createEvidence({
      organizationId: a.org.id,
      workspaceId: a.ws.id,
      fileName: 'Access_Control_Policy.pdf',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      category: 'Access Control',
      source: 'upload',
      uploadedAt: '2026-02-03T10:00:00.000Z',
      uploadedBy: 'crud@example.com',
      status: 'analyzed',
      frameworkKeys: ['soc2', 'iso27001'],
      content: 'multi-factor authentication is required',
      summary: 'Access control policy',
    });

    expect(created.id).toMatch(/^ev-[0-9a-f]{16}$/);
    expect(created.frameworkKeys).toEqual(['soc2', 'iso27001']);

    expect(await store.listEvidence(a.org.id, a.ws.id)).toHaveLength(1);

    const read = await store.getEvidence(created.id, a.org.id);
    expect(read?.fileName).toBe('Access_Control_Policy.pdf');
    expect(read?.content).toContain('multi-factor');

    const updated = await store.updateEvidence(created.id, a.org.id, {
      category: 'Security Policies',
      frameworkKeys: ['iso27001'],
    });
    expect(updated?.category).toBe('Security Policies');
    expect(updated?.frameworkKeys).toEqual(['iso27001']);
    // A partial patch must not blank unmentioned columns.
    expect(updated?.fileName).toBe('Access_Control_Policy.pdf');
    expect(updated?.content).toContain('multi-factor');

    expect(await store.deleteEvidence(created.id, a.org.id)).toBe(true);
    expect(await store.getEvidence(created.id, a.org.id)).toBeNull();
    expect(await store.deleteEvidence(created.id, a.org.id)).toBe(false);
  });

  it('returns evidence newest-first, like the previous Mongo sort', async () => {
    const a = await seedTenant('org-sort', 'sort@example.com');
    const base = {
      organizationId: a.org.id,
      workspaceId: a.ws.id,
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      category: 'Access Control',
      source: 'upload' as const,
      uploadedBy: 'sort@example.com',
      status: 'analyzed' as const,
      frameworkKeys: ['soc2' as const],
      content: '',
      summary: '',
    };
    await store.createEvidence({ ...base, fileName: 'old.pdf', uploadedAt: '2026-01-01T00:00:00.000Z' });
    await store.createEvidence({ ...base, fileName: 'new.pdf', uploadedAt: '2026-05-01T00:00:00.000Z' });
    await store.createEvidence({ ...base, fileName: 'mid.pdf', uploadedAt: '2026-03-01T00:00:00.000Z' });

    expect((await store.listEvidence(a.org.id, a.ws.id)).map((item) => item.fileName)).toEqual([
      'new.pdf',
      'mid.pdf',
      'old.pdf',
    ]);
  });

  it('survives a fresh store + fresh client against the same database', async () => {
    const a = await seedTenant('org-durable', 'durable@example.com');
    const created = await store.createEvidence({
      organizationId: a.org.id,
      workspaceId: a.ws.id,
      fileName: 'Persisted_Report.pdf',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4096,
      category: 'Access Control',
      source: 'upload',
      uploadedAt: '2026-04-01T00:00:00.000Z',
      uploadedBy: 'durable@example.com',
      status: 'analyzed',
      frameworkKeys: ['soc2'],
      content: 'retained text for the analysis engine',
      summary: 'Analysis result that must outlive the process',
    });

    // Simulate a redeploy: brand-new client object, same database rows.
    const restarted = newStore(createFakeSupabase(fake.db.clone(), undefined));
    const reread = await restarted.getEvidence(created.id, a.org.id);

    expect(reread).not.toBeNull();
    expect(reread!.fileName).toBe('Persisted_Report.pdf');
    expect(reread!.summary).toBe('Analysis result that must outlive the process');
    expect(reread!.content).toBe('retained text for the analysis engine');
    expect(reread!.status).toBe('analyzed');
    expect(reread!.uploadedAt).toBe('2026-04-01T00:00:00.000Z');
  });

  it('cascades evidence and reports when an organisation is removed', async () => {
    const a = await seedTenant('org-cascade', 'cascade@example.com');
    await store.createEvidence({
      organizationId: a.org.id,
      workspaceId: a.ws.id,
      fileName: 'x.pdf',
      fileExtension: 'pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1,
      category: 'Access Control',
      source: 'upload',
      uploadedAt: '2026-04-01T00:00:00.000Z',
      uploadedBy: 'cascade@example.com',
      status: 'analyzed',
      frameworkKeys: ['soc2'],
      content: '',
      summary: '',
    });

    fake.db.tables.organizations = fake.db.rows('organizations').filter((row) => row.id !== a.org.id);
    fake.db.cascadeDelete('organizations', [a.org.id]);

    expect(fake.db.rows('evidence')).toHaveLength(0);
    expect(fake.db.rows('workspaces')).toHaveLength(0);
    expect(fake.db.rows('users')).toHaveLength(0);
  });
});

describe('reports', () => {
  it('round-trips the full report summary as JSON', async () => {
    const a = await seedTenant('org-report', 'report@example.com');
    const summary = {
      executiveSummary: 'Readiness is strong.',
      recommendations: [{ controlCode: 'CC6.1', action: 'Document reviews', owner: 'Security', timelineLabel: '30 days', priority: 'P2' }],
    } as unknown as ReportRecord['summary'];

    const created = await store.createReport({
      id: 'rpt-json',
      organizationId: a.org.id,
      workspaceId: a.ws.id,
      name: 'SOC 2 Readiness Report',
      frameworkKey: 'soc2',
      companyName: 'Acme',
      fileName: 'soc2.pdf',
      generatedAt: '2026-05-05T12:00:00.000Z',
      status: 'ready',
      scoreIndex: 92,
      summary,
      requestedBy: 'report@example.com',
    });

    expect(created.scoreIndex).toBe(92);
    const reread = await store.getReport('rpt-json', a.org.id);
    expect(reread?.summary.executiveSummary).toBe('Readiness is strong.');
    expect(reread?.summary.recommendations?.[0]?.controlCode).toBe('CC6.1');
    expect(reread?.generatedAt).toBe('2026-05-05T12:00:00.000Z');
  });
});

describe('health reporting', () => {
  it('reports a persistent, connected store after a real query', async () => {
    await store.init();
    const health = await store.health();
    expect(health.ok).toBe(true);
    expect(health.kind).toBe('supabase');
    expect(health.persistent).toBe(true);
    expect(typeof health.latencyMs).toBe('number');
  });

  it('reports not-connected when the query fails, without leaking credentials', async () => {
    await store.init();
    fake.db.failWith = {
      message: 'fetch failed to https://abcdefgh.supabase.co/rest/v1 with apikey=sb_secret_TOPSECRET',
      code: 'ECONNREFUSED',
    };

    const health = await store.health();
    expect(health.ok).toBe(false);
    expect(health.persistent).toBe(true);
    expect(health.detail).not.toContain('sb_secret_TOPSECRET');
    expect(health.detail).not.toContain('abcdefgh.supabase.co');
  });
});

describe('query safety', () => {
  it('passes user-controlled values as filter parameters, never as SQL text', async () => {
    const a = await seedTenant('org-inject', 'inject@example.com');
    const hostile = "'; drop table evidence; --";

    expect(await store.getEvidence(hostile, a.org.id)).toBeNull();
    expect(await store.getUserByEmail(hostile)).toBeNull();

    // The value reached the builder as a bound filter value, and nothing was
    // destroyed by it.
    expect(fake.db.queryLog.some((entry) => entry.includes(hostile))).toBe(true);
    expect(fake.db.tables.evidence).toBeDefined();
  });
});

describe('a fresh FakeDatabase starts empty', () => {
  it('does not leak state between tests', () => {
    expect(new FakeDatabase().rows('organizations')).toHaveLength(0);
  });
});
