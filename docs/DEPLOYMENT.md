# Deployment

ComplyLens AI is a full-stack TypeScript app (Express API + React client). The single Node service is the recommended no-database demo shape. A Vercel serverless adapter is also included and its entrypoint is exercised locally by `npm run verify:deploy`; no hosted deployment has been performed:

| | Shape | Best for | State |
| --- | --- | --- | --- |
| **A** | One Node service: Express serves the API **and** the built client on one port (§2, Docker §4) | Long-running demos and container hosts; in-memory mode needs no paid AI or database | In-memory state survives for the life of the process |
| **B** | Vercel: static client on the CDN + one serverless function running the **same** Express app (§4) | Previews and production | State lives in Supabase PostgreSQL, shared by every instance |

Both keep the client and API on **one origin**, which is why neither needs CORS configuration. The code is identical in both shapes: `vercel.json` and `api/index.mjs` only describe *how* the existing Express app is reached, never a second implementation of it. A split deployment (client on Vercel, API on a container host) is also documented in §4 and needs `VITE_API_BASE_URL` + `CORS_ORIGINS`.

Verify whichever shape you pick before you rely on it:

```bash
npm run build && npm run verify:deploy   # checks vercel.json + boots the serverless entry and calls the API through it
npm run dev                              # container shape: one process, API + client
```

---

## 1. Prerequisites

- Node.js **22.12+** (Node 24 LTS recommended — it's Vercel's current default Function runtime; Node 20 was deprecated on Vercel on October 1, 2026) and npm 10+
- No database, no API keys, no third-party services required
- A Supabase project with the migrations in `supabase/migrations/` applied — **required in production** (see [`../supabase/README.md`](../supabase/README.md))

## 2. Production build

```bash
npm ci
npm run build          # type-checks + builds client/dist and compiles server/dist
NODE_ENV=production SESSION_SECRET="<long-random-string>" npm start
```

`npm start` runs `node server/dist/index.js` which:

1. initialises the store — Supabase PostgreSQL when `SUPABASE_URL` + `SUPABASE_SECRET_KEY` are set; in production a missing or unreachable database aborts startup instead of falling back to memory,
2. serves `/api/*` from Express,
3. serves the SPA from `client/dist` with a history fallback so deep links like `/app/gaps/find-soc2-cc7-2` work on refresh,
4. listens on `HOST`/`PORT` (default `0.0.0.0:4000`).

Verify: `GET /api/health` → `{"status":"ok", …}` and `GET /` → the app HTML.

> If the build has never run, the server logs a warning and exposes only `/` with a short message — it never crashes.

## 3. Environment variables for production

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` |
| `SESSION_SECRET` | **yes** | Long random string. Without it sessions are signed with a per-boot secret and every restart logs everyone out |
| `PORT` | no | Default `4000`; most platforms inject it |
| `HOST` | no | Default `0.0.0.0` |
| `TRUST_PROXY_HOPS` | no | Default `0`: trust no forwarded client IPs. Set only to the exact number of trusted proxies in front of the app; never use an unbounded trust setting |
| `SUPABASE_URL` | **yes** | `https://<project-ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | **yes** | Secret (service-role) key. Server-side only — never `VITE_`/`NEXT_PUBLIC_` |
| `SUPABASE_DB_SCHEMA`, `SUPABASE_EVIDENCE_BUCKET`, `SUPABASE_TIMEOUT_MS` | no | Defaults `public`, `evidence`, `10000` |
| `EVIDENCE_RETAIN_ORIGINAL_FILES` | no | Default `true`: keep original uploads in the private bucket |
| `STORE_DRIVER` | no | `auto` (default) \| `supabase` \| `memory`. `memory` is refused in production |
| `DATABASE_URL` | no | Only for `npm run db:migrate`; never read by the running server |
| `DEMO_MODE` | no | Default `true`: seeds the labelled AcmeCloud sample workspace and enables instant demo sessions. Set `false` for a private deployment |
| `AUTH_REQUIRED` | no | Set `true` to require a real sign-in for all `/api/*` routes |
| `MAX_UPLOAD_MB`, `ALLOWED_UPLOAD_TYPES` | no | Upload guards; defaults 10 MB, `pdf,docx,txt,csv` |
| `CORS_ORIGINS` | no | Only needed for a split deployment (see §5) |
| `AI_*` | no | Optional narrative provider — see [`AI-ABSTRACTION.md`](AI-ABSTRACTION.md) |

## 4. Platform recipes

### Railway / Render / Fly.io / any container host

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`
- Set `SESSION_SECRET`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

### Docker

A production image is included (`Dockerfile`, `node_modules` excluded via `.dockerignore`):

```bash
docker build -t complylens-ai .
docker run -p 4000:4000 -e SESSION_SECRET="<long-random-string>" complylens-ai
# → http://localhost:4000   (health check: GET /api/health)
```

The image builds the client and server in a first stage and ships only `server/dist`, `client/dist` and production `node_modules`. Pass `-e SUPABASE_URL=... -e SUPABASE_SECRET_KEY=...` to persist data, and `-e DEMO_MODE=false` for a private deployment.

### Vercel (serverless preview; shared persistence recommended)

The repository includes a Vercel configuration intended to serve the client and route `/api/*` to a single Node function running the existing Express app (`api/index.mjs` → `server/dist`). The entrypoint and PDF path were exercised locally by `npm run verify:deploy`; this does not verify or claim a hosted Vercel deployment. Function instances are ephemeral, so all state lives in Supabase PostgreSQL: configure `SUPABASE_URL` and `SUPABASE_SECRET_KEY` before relying on Vercel for stateful usage. A production build refuses to start without them.

```
https://your-app.vercel.app
├── /, /features, /pricing, …        → static SPA (client/dist)
├── /app/*                           → static SPA, client-side routes
└── /api/*                           → api/index.mjs (Express, identical routes)
```

Why this shape: the API and the client stay on **one origin**, so there is no CORS configuration, no `VITE_API_BASE_URL` and no second service to deploy. The Express routers, middleware, validation, store and PDF renderer are the same code that runs in the container deployment — nothing is re-implemented for the platform.

#### Deploy

1. Push the repository to GitHub (or run `vercel` from the repository root with the Vercel CLI).
2. Import the project in Vercel. `vercel.json` already sets everything that matters:
   - install: `npm install --include=dev`
   - build: `npm run build` (type-checks, builds `client/dist`, compiles `server/dist`)
   - output: `client/dist`
   - function: `api/index.mjs` (+ `api/[...path].mjs`) with `server/dist` and the pdfkit font data included
   - rewrites: `/api/:path*` → the function (path preserved, because Express routes on the original URL), everything else → `/index.html` (SPA history fallback)
   - headers: baseline security headers on all responses, immutable caching for `/assets/*`, `no-store` for `index.html`
3. Set environment variables (Project → Settings → Environment Variables) before any user-facing deployment:
   - `SESSION_SECRET` — long random string, so sessions survive a redeploy
   - `DEMO_MODE=true` (default) and `AUTH_REQUIRED=false` (default) for an open demo
   - `SUPABASE_URL` and `SUPABASE_SECRET_KEY` — **required**. Without them a production deployment refuses to boot rather than silently losing every upload, report and account to a per-instance memory store. Add them to Production, Preview and Development as needed, then **redeploy** (environment variables are read at function start)
4. Deploy, then verify: `/api/health` returns `{"status":"ok",…}` and `/` renders the landing page.

#### Vercel-specific behaviour

| Topic | Behaviour |
| --- | --- |
| Upload size | Vercel rejects request bodies above ~4.5 MB before the app sees them, so the default upload limit becomes **4 MB** on Vercel (`MAX_UPLOAD_MB` overrides it). The UI reads the limit from `/api/meta`, so the message always matches reality |
| Cold starts | Each instance connects to Supabase and seeds the demo workspace only if it is absent (idempotent). All instances share the same PostgreSQL data |
| PDF reports | Rendered in the function by pdfkit; the report is streamed and is not persisted to disk |
| Rate limiting | Per instance (fixed window). Use a shared store for a multi-instance production deployment |
| Timeouts | `maxDuration: 30s` is configured; verify actual limits and cold-start behaviour in the target Vercel project |

Use this shape for previews and production. Prefer the single Node service (§2) when you need uploads above 4 MB.

#### Alternative: client on Vercel + API elsewhere

Still supported. Build the client with `VITE_API_BASE_URL=https://api.example.com`, and on the API host set `CORS_ORIGINS=https://your-app.vercel.app` (comma-separated; preview URLs can be listed individually). The API only emits CORS headers for allowlisted origins and never with credentials, because tokens travel in the `Authorization` header.

### Reverse proxy (nginx) in front of the Node service

```nginx
location / {
  proxy_pass http://127.0.0.1:4000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 12m;   # keep >= MAX_UPLOAD_MB
}
```

When nginx is the app's sole trusted proxy, set `TRUST_PROXY_HOPS=1`. For a chain of trusted proxies, set the exact hop count only after verifying each proxy appends or overwrites forwarded headers. The default is `0` (ignore forwarded client IPs), which is safer for direct connections.

## 5. Split deployment notes

- Build the client with `VITE_API_BASE_URL` pointing at the API origin.
- Set `CORS_ORIGINS` on the API to a comma-separated allowlist (`*` is supported for throwaway demos only).
- Tokens travel in the `Authorization` header; no cookies are used, which keeps cross-origin setups simple and CSRF-free by construction.
- `X-Frame-Options: SAMEORIGIN` is only sent in production. Development and preview environments omit it so the app can be embedded by a preview frame.

## 6. Operations

| Concern | Today | Production recommendation |
| --- | --- | --- |
| Persistence | Supabase PostgreSQL | Enable Point-in-Time Recovery / scheduled backups in the Supabase dashboard; keep `SUPABASE_SECRET_KEY` in the platform secret manager and rotate it periodically |
| Sessions | HS256 JWT with `SESSION_SECRET` | Store the secret in the platform's secret manager; rotate with a short overlap window |
| Rate limiting | Per-process fixed windows (30 auth attempts/10 min; 600 API requests/min) | Replace with a shared store (Redis) when running more than one instance |
| Logging | Structured JSON lines to stdout | Ship stdout to your log platform; add request ids if you need tracing |
| Uploads | Parsed in memory; extracted text in PostgreSQL, original bytes in the private `evidence` bucket | Add antivirus scanning before accepting customer files at scale |
| Serverless | On Vercel uploads are capped at 4 MB; state is shared through Supabase | Use `MAX_UPLOAD_MB` deliberately |
| Monitoring | `/api/health` | Point the platform health check at it; alert on 5xx rate |
| Migrations | Version-controlled SQL in `supabase/migrations/`, applied with `supabase db push` or `npm run db:migrate` | Apply migrations **before** deploying code that depends on them; never edit an applied file |

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Vercel: every deployment fails outright (build never starts, or fails immediately with a Node.js version error) | `engines.node` in `package.json` must be a single simple range (e.g. `>=22.12.0`) — Vercel does not reliably support compound `\|\|` ranges like `^20.19.0 \|\| >=22.12.0` and rejects them with "Found invalid Node.js Version". Node 20 was also deprecated for new Vercel deployments on October 1, 2026, so any range that could resolve to 20.x will fail on a new project. Keep `engines.node` at `>=22.12.0` (resolves to the latest available major, currently 24.x) |
| `GET /` shows "ComplyLens AI API is running" | The client has not been built: run `npm run build`, or run in development mode |
| Everyone is signed out after a restart | `SESSION_SECRET` is not set |
| Uploads return 415/413 | Extension is outside `ALLOWED_UPLOAD_TYPES` (415) or file exceeds `MAX_UPLOAD_MB` (413) |
| Browser console shows CORS errors | The API origin is missing from `CORS_ORIGINS`, or the client was built with the wrong `VITE_API_BASE_URL` |
| Data disappears after redeploy | The deployment is on the in-memory store. Check `GET /api/health` → `database.kind`; set `SUPABASE_URL` + `SUPABASE_SECRET_KEY` and redeploy |
| Startup fails with `Missing required Supabase configuration in production` | The named variables are absent in that Vercel environment. Add them and redeploy |
| Startup fails with `The ComplyLens schema is missing` | The migrations were never applied to this project — run `supabase db push` or `npm run db:migrate` |
| `/api/health` returns 503 with `database.connected:false` | Supabase is unreachable, paused, or the secret key was rotated. The `category` in the server log distinguishes configuration / authentication / network / schema |
| 429 responses under load | Rate limiter; raise the limit in `app.ts` or front the API with a CDN for static assets |
| PDF download returns 401 | Use the in-app download action, which sends the `Authorization` header, and confirm the session is still valid; query-string tokens are not accepted |
| Vercel: every `/api/*` request 404s | The build did not run: check that `npm run build` succeeded and that `server/dist` is included by `functions."api/index.mjs".includeFiles` |
| Vercel: uploads over ~4 MB fail with a platform error | Vercel's request-body limit; keep `MAX_UPLOAD_MB` at or below 4, or move the API to a container host (§2) |
| Vercel: a "Cannot find module" error names an Express/pdfkit file | Add the missing path to `functions.*.includeFiles` in `vercel.json` and redeploy |
| Vercel: state resets between requests | Only possible on the in-memory store, which production refuses to use. Verify `GET /api/health` reports `database.kind: "supabase"` |
