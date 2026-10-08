/**
 * Frontend auth-state tests (TEST 10 / TEST 11 from the auth audit).
 *
 * These exercise `SessionProvider` the way the browser actually uses it:
 * `fetch` is mocked (no real network, no real server) so the tests pin down
 * the *client-side* contract — localStorage, React state and route guards
 * must never disagree about whether the user is signed in.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, useSession } from './session';
import { readSession, type StoredSession } from './api';
import type { SessionPayload, WorkspaceContext } from './types';

const SESSION_KEY = 'complylens.session';

const user = {
  id: 'usr-demo-owner',
  name: 'Dana Whitfield',
  email: 'demo@complylens.ai',
  jobTitle: 'Head of Security (demo persona)',
  role: 'owner' as const,
  isDemoUser: true,
};

const organization = {
  id: 'org_acmecloud',
  name: 'AcmeCloud',
  slug: 'acmecloud-demo',
  plan: 'growth' as const,
  primaryFramework: 'soc2' as const,
  industry: 'B2B SaaS',
  employeeCount: 48,
  createdAt: '2026-09-10T08:00:00.000Z',
  settings: {
    defaultFramework: 'soc2' as const,
    monthlyDigest: true,
    gapAlerts: true,
    reportReadyEmails: true,
    uploadNotifications: false,
    mfaRequired: true,
    sessionTimeoutMinutes: 30,
    allowedUploadTypes: ['pdf', 'docx', 'txt', 'csv'],
    retentionDays: 365,
  },
};

const workspace = {
  id: 'ws_acmecloud_demo',
  name: 'AcmeCloud Demo Workspace',
  isDemo: true,
  isDefault: true,
  createdAt: '2026-09-10T08:00:00.000Z',
  ownerUserId: 'usr-demo-owner',
};

function loginPayload(): SessionPayload {
  return {
    token: 'header.payload.signature',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user,
    organization,
    workspace,
    workspaces: [workspace],
    persistence: 'memory',
  };
}

function contextPayload(): WorkspaceContext {
  return {
    user,
    organization,
    workspace,
    workspaces: [workspace],
    demoMode: true,
    analysisMode: { key: 'demo-analysis', label: 'Demo Analysis Mode' },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Exposes the session hook's live values as text nodes for assertions. */
function Probe() {
  const { session, context, ready, login, logout } = useSession();
  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="authed">{String(Boolean(session?.token))}</span>
      <span data-testid="context">{String(Boolean(context))}</span>
      <button onClick={() => void login('demo@complylens.ai', 'DemoPass123!')}>login</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('SessionProvider — login → context → authenticated state', () => {
  it('TEST 10 precondition: login stores the session, loads /api/context, and marks the user authenticated', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/login')) return jsonResponse(200, loginPayload());
      if (url.endsWith('/api/context')) return jsonResponse(200, contextPayload());
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    expect(screen.getByTestId('authed').textContent).toBe('false');

    await act(async () => {
      screen.getByText('login').click();
    });

    await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('true'));
    await waitFor(() => expect(screen.getByTestId('context').textContent).toBe('true'));

    // The token must actually be persisted, not just held in React state —
    // a refresh re-reads localStorage, so this is what keeps the user signed in.
    const stored = readSession();
    expect(stored?.token).toBe('header.payload.signature');
    expect(stored?.user.email).toBe('demo@complylens.ai');
  });

  it('TEST 10: logout clears both the stored session and the in-memory context', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth/login')) return jsonResponse(200, loginPayload());
      if (url.endsWith('/api/context')) return jsonResponse(200, contextPayload());
      if (url.endsWith('/api/auth/logout')) return jsonResponse(200, { ok: true });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    await act(async () => {
      screen.getByText('login').click();
    });
    await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('true'));

    await act(async () => {
      screen.getByText('logout').click();
    });

    await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('false'));
    expect(screen.getByTestId('context').textContent).toBe('false');
    expect(readSession()).toBeNull();
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('TEST 11: a fresh mount (page refresh) restores the authenticated session from localStorage', async () => {
    const stored: StoredSession = {
      token: 'header.payload.signature',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: { id: user.id, name: user.name, email: user.email, isDemoUser: user.isDemoUser },
      organizationId: organization.id,
      workspaceId: workspace.id,
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(stored));

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/context')) {
        // The persisted token must be the one sent back to the API.
        const headers = new Headers(init?.headers);
        expect(headers.get('authorization')).toBe('Bearer header.payload.signature');
        return jsonResponse(200, contextPayload());
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    // Simulates the app re-mounting on a hard refresh: a brand-new provider
    // instance with nothing but what is already in localStorage.
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    expect(screen.getByTestId('authed').textContent).toBe('true');
    await waitFor(() => expect(screen.getByTestId('context').textContent).toBe('true'));
  });

  it('an invalid/expired token is cleared when /api/context rejects it with 401', async () => {
    const stored: StoredSession = {
      token: 'stale.token.value',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: { id: user.id, name: user.name, email: user.email, isDemoUser: user.isDemoUser },
      organizationId: organization.id,
      workspaceId: workspace.id,
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(stored));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/context')) {
        return jsonResponse(401, { error: { code: 'unauthorized', message: 'Your session has expired.' } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('false'));
    expect(readSession()).toBeNull();
  });
});
