/**
 * Optional client smoke test.
 *
 * Renders the real client against a running API inside jsdom and asserts that
 * every route mounts with live data and no console errors. Nothing here is part
 * of the shipped bundle — it is an extra verification step for developers.
 *
 *   npm i --no-save jsdom      # keeps the dependency list lean
 *   npm run dev                # in another terminal
 *   npm run smoke:client
 */

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:4000';

const errors: string[] = [];

async function main() {
  console.log(`Smoke-testing the client against ${BASE}`);

  let JSDOM: typeof import('jsdom').JSDOM;
  try {
    ({ JSDOM } = await import('jsdom'));
  } catch {
    console.error(
      'This optional smoke test needs jsdom:\n' +
        '  npm i --no-save jsdom\n' +
        'It also expects the app to be running (npm run dev).',
    );
    process.exit(2);
  }
  // 1. A real demo session so protected routes have a valid token.
  const authResponse = await fetch(`${BASE}/api/auth/demo`, { method: 'POST' });
  const session = (await authResponse.json()) as {
    token: string;
    expiresAt: string;
    user: { id: string; name: string; email: string; isDemoUser: boolean };
    organization: { id: string };
    workspace: { id: string };
  };

  const authorized = { authorization: `Bearer ${session.token}` };
  const gapList = (await (await fetch(`${BASE}/api/gaps`, { headers: authorized })).json()) as {
    items: Array<{ id: string }>;
  };
  const reportList = (await (await fetch(`${BASE}/api/reports`, { headers: authorized })).json()) as {
    items: Array<{ id: string }>;
  };
  const findingId = gapList.items[0]?.id ?? 'find-soc2-cc7-2';
  const reportId = reportList.items[0]?.id ?? '';

  const routes: Array<{ path: string; expect: string[] }> = [
    { path: '/', expect: ['Know what', 'Try the Demo', 'See How It Works', 'Compliance readiness analysis'] },
    { path: '/features', expect: ['Evidence Analysis'] },
    { path: '/how-it-works', expect: ['UPLOAD'] },
    { path: '/security', expect: ['security'] },
    { path: '/pricing', expect: ['149', 'Demo pricing'] },
    { path: '/faq', expect: ['?'] },
    { path: '/documentation', expect: ['Architecture'] },
    { path: '/overview', expect: ['Product Overview'] },
    { path: '/privacy', expect: ['Privacy'] },
    { path: '/terms', expect: ['Terms'] },
    { path: '/login', expect: ['Log in'] },
    { path: '/signup', expect: ['Create'] },
    { path: '/forgot-password', expect: ['Reset'] },
    { path: '/app/dashboard', expect: ['Readiness', '92', 'Critical gaps', 'Critical-risk findings only', 'Evidence-to-control mapping'] },
    { path: '/app/evidence', expect: ['Access_Control_Policy', 'DEMO'] },
    { path: '/app/evidence/ev-demo-access-control-policy', expect: ['Access Control'] },
    { path: '/app/controls', expect: ['SOC2-CC6.1'] },
    { path: '/app/controls/SOC2-CC6.1', expect: ['Quarterly', 'access'] },
    { path: '/app/mappings', expect: ['mapping'] },
    { path: '/app/gaps', expect: ['Critical findings'] },
    { path: `/app/gaps/${findingId}`, expect: ['Remediation'] },
    { path: '/app/reports', expect: ['Readiness reports', '50 controls across 2 frameworks', '28 SOC 2', '22 ISO 27001'] },
    { path: `/app/reports/${reportId}`, expect: ['Executive summary'] },
    { path: '/app/frameworks', expect: ['ISO', '78'] },
    { path: '/app/settings', expect: ['Organization'] },
    { path: '/app/help', expect: ['Five-minute demo walkthrough'] },
    { path: '/does-not-exist', expect: ['does not exist'] },
    { path: '/app/does-not-exist', expect: ['does not exist'] },
  ];

  let failures = 0;

  for (const route of routes) {
    const html = '<!doctype html><html><body><div id="root"></div></body></html>';
    const dom = new JSDOM(html, { url: `${BASE}${route.path}`, pretendToBeVisual: true });
    const { window } = dom;

    // ---- Environment shims -------------------------------------------------
    (globalThis as Record<string, unknown>).window = window;
    (globalThis as Record<string, unknown>).document = window.document;
    (globalThis as Record<string, unknown>).navigator = window.navigator;
    (globalThis as Record<string, unknown>).HTMLElement = window.HTMLElement;
    (globalThis as Record<string, unknown>).HTMLAnchorElement = window.HTMLAnchorElement;
    (globalThis as Record<string, unknown>).Element = window.Element;
    (globalThis as Record<string, unknown>).Node = window.Node;
    (globalThis as Record<string, unknown>).getComputedStyle = window.getComputedStyle;
    (globalThis as Record<string, unknown>).requestAnimationFrame = window.requestAnimationFrame.bind(window);
    (globalThis as Record<string, unknown>).cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    (globalThis as Record<string, unknown>).localStorage = window.localStorage;
    const realFetch = globalThis.fetch;
    const absoluteFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      realFetch(typeof input === 'string' && input.startsWith('/') ? `${BASE}${input}` : input, init)) as typeof fetch;
    (globalThis as Record<string, unknown>).fetch = absoluteFetch;
    window.fetch = absoluteFetch as unknown as typeof window.fetch;
    window.scrollTo = (() => {}) as typeof window.scrollTo;
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = false;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const localErrors: string[] = [];
    window.console.error = (...args: unknown[]) => {
      localErrors.push(args.map((value) => (value instanceof Error ? value.message : String(value))).join(' '));
    };
    window.console.warn = (...args: unknown[]) => {
      localErrors.push(args.map((value) => (value instanceof Error ? value.message : String(value))).join(' '));
    };

    window.localStorage.setItem(
      'complylens.session',
      JSON.stringify({
        token: session.token,
        expiresAt: session.expiresAt,
        user: session.user,
        organizationId: session.organization.id,
        workspaceId: session.workspace.id,
      }),
    );

    const { createRoot } = await import('react-dom/client');
    const React = await import('react');
    const { App } = await import('../client/src/App.js');

    const container = window.document.getElementById('root');
    const root = createRoot(container as unknown as Element);
    root.render(React.createElement(App));

    await new Promise((resolve) => setTimeout(resolve, 1800));

    const text = window.document.body.textContent ?? '';
    const missing = route.expect.filter((needle) => !text.toLowerCase().includes(needle.toLowerCase()));
    const crashed = /Minified React error|The above error occurred|Something went wrong and the page could not render/i.test(text);

    if (missing.length > 0 || crashed) {
      failures += 1;
      console.log(`✗ ${route.path}${missing.length ? ` — missing: ${missing.join(', ')}` : ''}${crashed ? ' — render error text found' : ''}`);
      if (localErrors.length > 0) console.log(`    console: ${localErrors.slice(0, 3).join(' | ')}`);
      console.log(`    text: ${text.replace(/\s+/g, ' ').slice(0, 220)}`);
      errors.push(`${route.path}: ${missing.join(', ')} ${localErrors.join(' | ')}`);
    } else {
      console.log(`✓ ${route.path} (${text.replace(/\s+/g, ' ').length} chars${localErrors.length ? `, ${localErrors.length} console errors` : ''})`);
      if (localErrors.length > 0) {
        const relevant = localErrors.filter((entry) => !entry.includes('not wrapped in act'));
        if (relevant.length > 0) {
          failures += 1;
          console.log(`    console: ${relevant.slice(0, 3).join(' | ')}`);
        }
      }
    }

    root.unmount();
  }

  console.log(failures === 0 ? '\nAll routes rendered cleanly.' : `\n${failures} route(s) had problems.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('smoke test failed', error);
  process.exit(1);
});
