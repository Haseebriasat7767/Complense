/**
 * Free plan + reusable questionnaire library.
 *
 * Boots the real Express app (in-memory store, no external services) and
 * walks the buyer-visible flows: a new signup lands on the Free plan with
 * an empty workspace, plan limits are enforced server-side, and the
 * questionnaire library answers once, suggests reuse by exact question
 * match, and only copies an answer after explicit human confirmation.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { attachErrorHandling, createApp } from '../src/app.js';
import { assertWithinLimit, PLAN_LIMITS } from '../src/billing/entitlements.js';
import { CANONICAL_QUESTIONS } from '../src/domain/questionnaire-catalog.js';
import { ApiError } from '../src/http/errors.js';
import { closeStore, initStore } from '../src/store/index.js';
import type { Organization } from '../src/domain/types.js';

// Keep HTTP integration tests isolated from Supabase Storage.
vi.mock('../src/services/original-files.js', () => ({
  uploadOriginalFile: vi.fn().mockResolvedValue(undefined),
  downloadOriginalFile: vi.fn(),
  deleteOriginalFile: vi.fn().mockResolvedValue(undefined),
}));

let server: http.Server;
let base: string;
let freeToken: string;
let demoToken: string;

async function call(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function json(path: string, token: string | null, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const response = await call(path, token, init);
  const text = await response.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

beforeAll(async () => {
  await initStore();
  const app = createApp();
  attachErrorHandling(app);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;

  const demo = await json('/api/auth/login', null, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'demo@complylens.ai', password: 'DemoPass123!' }),
  });
  expect(demo.status).toBe(200);
  demoToken = demo.body.token;

  // A brand-new signup: Free plan, no seeded sample documents.
  const signup = await json('/api/auth/signup', null, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Free Tester',
      email: 'free-tester@example.com',
      password: 'FreeTester123!',
      organizationName: 'Free Test Co',
    }),
  });
  expect(signup.status).toBe(201);
  freeToken = signup.body.token;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeStore();
});

describe('Free plan defaults', () => {
  it('new signups land on the Free plan', async () => {
    const { status, body } = await json('/api/auth/session', freeToken);
    expect(status).toBe(200);
    expect(body.organization.plan).toBe('free');
  });

  it('a new Free workspace starts empty — no seeded sample documents', async () => {
    const { status, body } = await json('/api/evidence', freeToken);
    expect(status).toBe(200);
    expect(body.total).toBe(0);
  });

  it('plan limits are the documented Free limits', () => {
    expect(PLAN_LIMITS.free).toEqual({
      documents: 10,
      frameworks: 1,
      workspaces: 1,
      reports: 1,
      questionnaires: 1,
      reusableAnswers: 25,
    });
  });

  it('the limit guard throws 403 plan_limit_reached at the limit', async () => {
    const org = { plan: 'free' } as Organization;
    await expect(assertWithinLimit(org, 'documents', 9)).resolves.toBeUndefined();
    let caught: unknown;
    try {
      await assertWithinLimit(org, 'documents', 10);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(403);
    expect((caught as ApiError).code).toBe('plan_limit_reached');
  });

  it('billing usage reports the Free plan, limits and current usage', async () => {
    const { status, body } = await json('/api/billing/usage', freeToken);
    expect(status).toBe(200);
    expect(body.plan).toBe('free');
    expect(body.limits.documents.limit).toBe(10);
    expect(body.usage.documents).toBe(0);
    expect(body.usage.workspaces).toBe(1);
  });
});

describe('questionnaire catalog', () => {
  it('seeds 25 canonical questions: 7 SOC 2, 7 ISO 27001, 11 generic', () => {
    expect(CANONICAL_QUESTIONS).toHaveLength(25);
    expect(CANONICAL_QUESTIONS.filter((q) => q.framework === 'soc2')).toHaveLength(7);
    expect(CANONICAL_QUESTIONS.filter((q) => q.framework === 'iso27001')).toHaveLength(7);
    expect(CANONICAL_QUESTIONS.filter((q) => q.framework === 'generic')).toHaveLength(11);
  });

  it('every canonical question points at real control codes', async () => {
    const { status, body } = await json('/api/questionnaire-library/catalog', freeToken);
    expect(status).toBe(200);
    expect(body.total).toBe(25);
    for (const item of body.items as Array<{ relatedControls: string[] }>) {
      expect(item.relatedControls.length).toBeGreaterThan(0);
    }
  });

  it('catalog filters by framework', async () => {
    const { status, body } = await json('/api/questionnaire-library/catalog?framework=soc2', freeToken);
    expect(status).toBe(200);
    expect(body.total).toBe(7);
  });

  it('catalog requires authentication', async () => {
    const { status } = await json('/api/questionnaire-library/catalog', null);
    expect(status).toBe(401);
  });
});

describe('reusable answers', () => {
  it('saves a reusable answer, then updates it instead of duplicating', async () => {
    const first = await json('/api/questionnaire-library/answers', freeToken, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionSlug: 'soc2-mfa-access-control',
        answer: 'MFA is enforced for all production access via authenticator apps.',
        status: 'approved',
      }),
    });
    expect(first.status).toBe(201);
    expect(first.body.answer.questionSlug).toBe('soc2-mfa-access-control');

    const second = await json('/api/questionnaire-library/answers', freeToken, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        questionSlug: 'soc2-mfa-access-control',
        answer: 'MFA is enforced for all production access via hardware keys.',
        status: 'approved',
      }),
    });
    expect(second.status).toBe(200);
    expect(second.body.answer.id).toBe(first.body.answer.id);

    const list = await json('/api/questionnaire-library/answers', freeToken);
    expect(list.status).toBe(200);
    expect(list.body.items.filter((a: any) => a.questionSlug === 'soc2-mfa-access-control')).toHaveLength(1);
    expect(list.body.items[0].answer).toContain('hardware keys');
  });

  it('rejects an unknown canonical slug', async () => {
    const { status } = await json('/api/questionnaire-library/answers', freeToken, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionSlug: 'no-such-question', answer: 'x' }),
    });
    expect(status).toBe(400);
  });
});

describe('questionnaires and explicit-confirm reuse', () => {
  let questionnaireId: string;

  it('creates a questionnaire on the Free plan', async () => {
    const { status, body } = await json('/api/questionnaire-library/questionnaires', freeToken, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Acme Corp vendor review', requester: 'Acme Corp' }),
    });
    expect(status).toBe(201);
    questionnaireId = body.questionnaire.id;
  });

  it('enforces the Free 1-questionnaire limit on a second create', async () => {
    const { status, body } = await json('/api/questionnaire-library/questionnaires', freeToken, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Second review', requester: 'Beta Ltd' }),
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe('plan_limit_reached');
  });

  it('adding a catalog question suggests the library answer but copies nothing', async () => {
    const { status, body } = await json(`/api/questionnaire-library/questionnaires/${questionnaireId}/items`, freeToken, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionSlug: 'soc2-mfa-access-control' }),
    });
    expect(status).toBe(201);
    expect(body.suggestedAnswer).not.toBeNull();
    expect(body.suggestedAnswer.answer).toContain('hardware keys');
    expect(body.item.answer).toBeUndefined();
    expect(body.item.answerSource).toBe('none');
    expect(body.item.reuseConfirmed).toBe(false);
  });

  it('reuse without explicit confirmation is rejected', async () => {
    const detail = await json(`/api/questionnaire-library/questionnaires/${questionnaireId}`, freeToken);
    const itemId = detail.body.items[0].id;
    const { status } = await json(
      `/api/questionnaire-library/questionnaires/${questionnaireId}/items/${itemId}/reuse`,
      freeToken,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: false }),
      },
    );
    expect(status).toBe(400);
  });

  it('reuse with explicit confirmation copies the library answer', async () => {
    const detail = await json(`/api/questionnaire-library/questionnaires/${questionnaireId}`, freeToken);
    const itemId = detail.body.items[0].id;
    const { status, body } = await json(
      `/api/questionnaire-library/questionnaires/${questionnaireId}/items/${itemId}/reuse`,
      freeToken,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      },
    );
    expect(status).toBe(200);
    expect(body.item.answer).toContain('hardware keys');
    expect(body.item.answerSource).toBe('library');
    expect(body.item.reuseConfirmed).toBe(true);
    expect(body.item.status).toBe('answered');
  });

  it('exports the questionnaire as CSV with the reused answer labelled', async () => {
    const response = await call(`/api/questionnaire-library/questionnaires/${questionnaireId}/export?format=csv`, freeToken);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    const text = await response.text();
    expect(text).toContain('multi-factor authentication');
    expect(text).toContain('library');
  });

  it('exports the questionnaire as PDF', async () => {
    const response = await call(`/api/questionnaire-library/questionnaires/${questionnaireId}/export?format=pdf`, freeToken);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('auditor package and report quota', () => {
  it('downloads the auditor package as a PDF', async () => {
    const response = await call('/api/questionnaire-library/auditor-package?framework=soc2', demoToken);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('enforces the Free 1-report limit', async () => {
    const first = await json('/api/reports', freeToken, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ frameworkKey: 'soc2' }),
    });
    expect(first.status).toBe(201);
    const second = await json('/api/reports', freeToken, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ frameworkKey: 'iso27001' }),
    });
    expect(second.status).toBe(403);
    expect(second.body.error.code).toBe('plan_limit_reached');
  });

  it('a Free upload succeeds while under the 10-document limit', async () => {
    const form = new FormData();
    form.append('file', new Blob(['Access control policy. MFA is required for all users.'], { type: 'text/plain' }), 'policy.txt');
    const response = await call('/api/evidence', freeToken, { method: 'POST', body: form });
    expect(response.status).toBe(201);
  });
});
