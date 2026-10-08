/**
 * Deployment verification (Vercel shape).
 *
 * Checks the things that actually break a Vercel deployment of this repository:
 *   1. vercel.json exists, parses and routes /api + the SPA correctly;
 *   2. the serverless entry (`api/index.mjs`) exports a request handler;
 *   3. the handler boots the Express app without `server.listen` and answers
 *      real API requests (health 200, protected route 401, demo session 200);
 *   4. the PDF report path works through the function.
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
/* 1. vercel.json                                                             */
/* -------------------------------------------------------------------------- */
console.log('\n=== vercel.json ===');
const configPath = path.join(root, 'vercel.json');
check('vercel.json exists', existsSync(configPath));
const config = JSON.parse(readFileSync(configPath, 'utf8'));
check('outputDirectory is client/dist', config.outputDirectory === 'client/dist', config.outputDirectory);
check('buildCommand builds both workspaces', config.buildCommand === 'npm run build', config.buildCommand);
const sources = (config.rewrites ?? []).map((rule) => rule.source);
check('routes /api/* to the function', sources.some((source) => source.startsWith('/api/')), JSON.stringify(sources));
check('has an SPA fallback to /index.html', sources.includes('/(.*)'));
check(
  'the API rewrite preserves the request path (Express routing depends on it)',
  (config.rewrites ?? []).some((rule) => rule.source === '/api/:path*' && rule.destination === '/api/:path*'),
);
check(
  'api/index.mjs is configured as a function',
  Boolean(config.functions?.['api/index.mjs']),
  JSON.stringify(Object.keys(config.functions ?? {})),
);
check(
  'the function ships server/dist and pdfkit font data',
  String(config.functions?.['api/index.mjs']?.includeFiles ?? '').includes('server/dist') &&
    String(config.functions?.['api/index.mjs']?.includeFiles ?? '').includes('pdfkit'),
);
check('static responses carry baseline security headers', (config.headers ?? []).length >= 1);

/* -------------------------------------------------------------------------- */
/* 2. The entry point itself                                                  */
/* -------------------------------------------------------------------------- */
console.log('\n=== serverless entry ===');
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
  console.log('The Vercel deployment shape is verified: static client + one Express function.');
}
