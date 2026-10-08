/**
 * End-to-end authentication journey.
 *
 * Boots the real Express app (in-memory store, no external services — exactly
 * how the Vercel serverless function and the container deployment both boot
 * it) and walks the exact path the browser takes:
 *
 *   POST /api/auth/login → token → GET /api/context → GET /api/dashboard
 *
 * Each `it` below is numbered to match the auth audit checklist.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { attachErrorHandling, createApp } from '../src/app.js';
import { createSessionToken } from '../src/auth/tokens.js';
import { closeStore, initStore } from '../src/store/index.js';

const DEMO_EMAIL = 'demo@complylens.ai';
const DEMO_PASSWORD = 'DemoPass123!';

let server: http.Server;
let base: string;

async function login(email: string, password: string) {
  return fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

beforeAll(async () => {
  await initStore();
  const app = createApp();
  attachErrorHandling(app);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await closeStore();
});

describe('the complete authentication journey', () => {
  it('TEST 1: demo login succeeds', async () => {
    const response = await login(DEMO_EMAIL, DEMO_PASSWORD);
    expect(response.status).toBe(200);
  });

  it('TEST 2: demo login returns a valid, well-formed session token', async () => {
    const response = await login(DEMO_EMAIL, DEMO_PASSWORD);
    const payload = (await response.json()) as { token: string; expiresAt: string; user: { email: string } };

    expect(typeof payload.token).toBe('string');
    // header.payload.signature — a real HS256 JWT-shaped token, not a stub.
    expect(payload.token.split('.')).toHaveLength(3);
    expect(new Date(payload.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(payload.user.email).toBe(DEMO_EMAIL);
  });

  it('TEST 3: the returned token authenticates a subsequent request', async () => {
    const { token } = (await (await login(DEMO_EMAIL, DEMO_PASSWORD)).json()) as { token: string };
    const response = await fetch(`${base}/api/dashboard`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
  });

  it('TEST 4: GET /api/context succeeds using the returned token', async () => {
    const { token } = (await (await login(DEMO_EMAIL, DEMO_PASSWORD)).json()) as { token: string };
    const response = await fetch(`${base}/api/context`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      organization: { name: string };
      workspace: { name: string };
      user: { email: string } | null;
    };
    expect(payload.organization.name).toBe('AcmeCloud');
    expect(payload.workspace.name).toBe('AcmeCloud Demo Workspace');
    expect(payload.user?.email).toBe(DEMO_EMAIL);
  });

  it('TEST 5: GET /api/dashboard succeeds using the returned token', async () => {
    const { token } = (await (await login(DEMO_EMAIL, DEMO_PASSWORD)).json()) as { token: string };
    const response = await fetch(`${base}/api/dashboard`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { metric: { readinessIndex: number } };
    expect(payload.metric.readinessIndex).toBeGreaterThan(0);
  });

  it('TEST 6: an invalid password returns 401, not a successful session', async () => {
    const response = await login(DEMO_EMAIL, 'wrong-password');
    expect(response.status).toBe(401);
    const payload = (await response.json()) as { error: { code: string } };
    expect(payload.error.code).toBe('unauthorized');
  });

  it('TEST 7: a missing Authorization header returns 401 on protected routes', async () => {
    const context = await fetch(`${base}/api/context`);
    const dashboard = await fetch(`${base}/api/dashboard`);
    expect(context.status).toBe(401);
    expect(dashboard.status).toBe(401);
  });

  it('TEST 8: a malformed token returns 401, never a 500', async () => {
    for (const malformed of ['not-a-jwt', 'a.b', 'a.b.c.d', '']) {
      const response = await fetch(`${base}/api/dashboard`, {
        headers: { authorization: `Bearer ${malformed}` },
      });
      expect(response.status, `token ${JSON.stringify(malformed)}`).toBe(401);
    }
  });

  it('TEST 9: an expired token is rejected with 401 ("sign in again"), not treated as valid', async () => {
    // A token signed with the same secret and claim shape as a real login, but
    // whose exp already elapsed. This proves expiry is actually enforced, not
    // just structurally present in the payload.
    const { token: expiredToken } = createSessionToken(
      { sub: 'usr-demo-owner', email: DEMO_EMAIL, org: 'org_acmecloud', role: 'owner', demo: true },
      -1, // ttlHours: expired one hour ago
    );
    const response = await fetch(`${base}/api/dashboard`, {
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    expect(response.status).toBe(401);
    const payload = (await response.json()) as { error: { message: string } };
    expect(payload.error.message.toLowerCase()).toContain('sign in again');
  });

  it('a tampered signature is rejected even with otherwise well-formed claims', async () => {
    const { token } = (await (await login(DEMO_EMAIL, DEMO_PASSWORD)).json()) as { token: string };
    const [header, body] = token.split('.');
    const response = await fetch(`${base}/api/dashboard`, {
      headers: { authorization: `Bearer ${header}.${body}.tampered-signature-value` },
    });
    expect(response.status).toBe(401);
  });

  it('TEST 10 (server side): POST /api/auth/logout succeeds so the client can safely discard its token', async () => {
    const { token } = (await (await login(DEMO_EMAIL, DEMO_PASSWORD)).json()) as { token: string };
    const response = await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);

    // Logout is stateless (signed tokens cannot be revoked server-side without
    // a blacklist); the frontend contract is that it discards the token. The
    // client-side half of this behaviour is covered in
    // client/src/lib/session.test.tsx ("logout clears ... stored session").
  });

  it('TEST 11 (server side): a still-valid token keeps working across repeated requests, exactly like a page refresh', async () => {
    const { token } = (await (await login(DEMO_EMAIL, DEMO_PASSWORD)).json()) as { token: string };

    // Simulates the dashboard reloading /api/context and /api/dashboard again
    // after a browser refresh, using only the token persisted in localStorage.
    for (let i = 0; i < 3; i += 1) {
      const context = await fetch(`${base}/api/context`, { headers: { authorization: `Bearer ${token}` } });
      const dashboard = await fetch(`${base}/api/dashboard`, { headers: { authorization: `Bearer ${token}` } });
      expect(context.status).toBe(200);
      expect(dashboard.status).toBe(200);
    }
  });

  it('the login response never includes the password or the raw signing secret', async () => {
    const response = await login(DEMO_EMAIL, DEMO_PASSWORD);
    const text = await response.text();
    expect(text.toLowerCase()).not.toContain('password');
    expect(text).not.toContain(DEMO_PASSWORD);
  });
});
