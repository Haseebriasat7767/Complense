/**
 * Deployment verification (Vercel services shape).
 *
 * Checks the things that actually break a Vercel services deployment of this
 * repository:
 *   1. vercel.json exists, parses, declares a `services` block with `client`
 *      and `server`, and routes /api + the SPA to the correct services;
 *   2. the serverless entry (`api/index.mjs`) still exports a request handler
 *      (kept for local testing / backward-compatible non-services deploys);
 *   3. the handler boots the Express app without `server.listen` and answers
 *      real API requests (health 200, protected route 401, demo session 200);
 *   4. the PDF report path works through the function;
 *   5. the server Dockerfile exists for the container service.
 *
 * Requires a build first (the entry imports `server/dist`):
 *
 *   npm run build && npm run verify:deploy
 */
import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let checks = 0;

function check(label, condition, detail = '') {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/* -------------------------------------------------------------------------- */
/* 1. vercel.json — services configuration                                    */
/* -------------------------------------------------------------------------- */
console.log('\n=== vercel.json (services) ===');
const configPath = path.join(root, 'vercel.json');
check('vercel.json exists', existsSync(configPath));
const config = JSON.parse(readFileSync(configPath, 'utf8'));

// Services block
check('has a services block', Boolean(config.services), JSON.stringify(Object.keys(config)));
const services = config.services ?? {};
check('declares a "client" service', Boolean(services.client));
check('declares a "server" service', Boolean(services.server));
check(
  'client service uses framework: vite',
  services.client?.framework === 'vite',
  String(services.client?.framework),
);
check(
  'client service root is "client"',
  services.client?.root === 'client',
  String(services.client?.root),
);
check(
  'server service uses runtime: container',
  services.server?.runtime === 'container',
  String(services.server?.runtime),
);
check(
  'server service root is "." (repo root, uses the root Dockerfile)',
  services.server?.root === '.',
  String(services.server?.root),
);

// Bindings
const serverBindings = services.server?.bindings ?? [];
check(
  'server has a binding to the client service',
  serverBindings.some(
    (b: { type: string; service: string; format: string; env: string }) =>
      b.type === 'service' && b.service === 'client' && b.format === 'url' && b.env === 'CLIENT_URL',
  ),
  JSON.stringify(serverBindings),
);
check(
  'binding has all four required fields (type, service, format, env)',
  serverBindings.every(
    (b: { type?: string; service?: string; format?: string; env?: string }) =>
      Boolean(b.type && b.service && b.format && b.env),
  ),
  JSON.stringify(serverBindings),
);

// No top-level keys that are invalid in services mode
const invalidTopLevel = ['functions', 'buildCommand', 'installCommand', 'devCommand', 'outputDirectory', 'framework'];
for (const key of invalidTopLevel) {
  check(`top-level "${key}" is absent (invalid in services mode)`, config[key] === undefined, String(config[key]));
}

// Rewrites
const rewrites = config.rewrites ?? [];
const sources = rewrites.map((rule) => rule.source);
check('routes /api/(.*) to the server service', rewrites.some((rule) => rule.source === '/api/(.*)' && rule.destination?.service === 'server'), JSON.stringify(rewrites));
check('routes /(.*) to the client service (SPA fallback)', rewrites.some((rule) => rule.source === '/(.*)' && rule.destination?.service === 'client'), JSON.stringify(rewrites));

// Order: /api/* must come before the catch-all
const apiIndex = rewrites.findIndex((rule) => rule.source === '/api/(.*)');
const catchAllIndex = rewrites.findIndex((rule) => rule.source === '/(.*)');
check(
  '/api/(.*) rewrite comes before the catch-all',
  apiIndex >= 0 && catchAllIndex >= 0 && apiIndex < catchAllIndex,
  `api=${apiIndex}, catch-all=${catchAllIndex}`,
);

// Security headers
check('static responses carry baseline security headers', (config.headers ?? []).length >= 1);

/* -------------------------------------------------------------------------- */
/* 1b. Dockerfile (required for the server container service)                 */
/* -------------------------------------------------------------------------- */
console.log('\n=== Dockerfile (server container service) ===');
const dockerfile = path.join(root, 'Dockerfile');
check('root Dockerfile exists (used by the server container service)', existsSync(dockerfile));
if (existsSync(dockerfile)) {
  const dockerfileContent = readFileSync(dockerfile, 'utf8');
  check('Dockerfile uses node:22 base', dockerfileContent.includes('node:22'));
  check('Dockerfile compiles server TypeScript', dockerfileContent.includes('npm run build'));
  check('Dockerfile CMD starts the server', dockerfileContent.includes('server/dist/index.js'));
  check('Dockerfile sets NODE_ENV=production', dockerfileContent.includes('NODE_ENV=production'));
  check('Dockerfile includes client build (server is self-contained)', dockerfileContent.includes('client/dist'));
}

/* -------------------------------------------------------------------------- */
/* 2. The serverless entry point (backward-compatible, for local testing)     */
/* -------------------------------------------------------------------------- */
console.log('\n=== serverless entry (backward-compatible) ===');
check('server/dist exists (run npm run build first)', existsSync(path.join(root, 'server/dist/app.js')));
check('api/index.mjs exists', existsSync(path.join(root, 'api/index.mjs')));
const entry = await import(path.join(root, 'api', '[...path].mjs'));
check('api/[...path].mjs exports a default handler', typeof entry.default === 'function');

/* -------------------------------------------------------------------------- */
/* 3. Real requests through the handler                                       */
/* -------------------------------------------------------------------------- */
console.log('\n=== requests through the function ===');
const server = http.createServer((req, res) => {
  Promise.resolve(entry.default(req, res)).catch(() => {
    res.statusCode = 500;
    res.end('{"error":"handler threw"}');
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

try {
  const health = await fetch(`${base}/api/health`);
  const healthBody = await health.json();
  check('GET /api/health → 200', health.status === 200, String(health.status));
  check('demo mode is active on a cold start', healthBody.demoMode === true && healthBody.store.kind === 'memory');

  const unauth = await fetch(`${base}/api/dashboard`);
  check('GET /api/dashboard without a token → 401', unauth.status === 401, String(unauth.status));

  const session = await fetch(`${base}/api/auth/demo`, { method: 'POST' });
  check('POST /api/auth/demo → 200', session.status === 200, String(session.status));
  const { token } = await session.json();

  const dashboard = await fetch(`${base}/api/dashboard`, { headers: { authorization: `Bearer ${token}` } });
  const dashboardBody = await dashboard.json();
  check('GET /api/dashboard → 92% SOC 2 readiness', dashboardBody.metric?.readinessIndex === 92);
  check(
    'dashboard counts match the documented demo figures',
    dashboardBody.counts?.reviewed === 24 &&
      dashboardBody.counts?.passed === 18 &&
      dashboardBody.counts?.needsAttention === 4 &&
      dashboardBody.counts?.missing === 2,
  );

  const created = await fetch(`${base}/api/reports`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ framework: 'soc2' }),
  });
  const createdBody = await created.json();
  check('POST /api/reports → 201', created.status === 201, String(created.status));

  const pdf = await fetch(`${base}/api/reports/${createdBody.report.id}/pdf`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  check('GET /api/reports/:id/pdf → real PDF', pdf.status === 200 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-', String(pdf.status));
  check('PDF is a full report (pdfkit fonts loaded)', bytes.length > 10_000, `${bytes.length} bytes`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(`\n${checks - failures.length}/${checks} deployment checks passed.`);
if (failures.length > 0) {
  console.log('Failed checks:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log('The Vercel services deployment shape is verified: client (Vite) + server (container).');
}
