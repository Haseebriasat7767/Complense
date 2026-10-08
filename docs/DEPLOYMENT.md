# Deployment

ComplyLens AI ships as a **single Node service** that serves both the JSON API and the prebuilt web client. That is the recommended deployment: one port, one origin, no CORS, no environment drift between the API and the client.

---

## 1. Prerequisites

- Node.js **20.11 or newer** (Node 22 recommended) and npm 10+
- No database, no API keys, no third-party services required
- For persistence: a MongoDB connection string (optional)

## 2. Production build

```bash
npm ci
npm run build          # type-checks + builds client/dist and compiles server/dist
NODE_ENV=production SESSION_SECRET="<long-random-string>" npm start
```

`npm start` runs `node server/dist/index.js` which:

1. initialises the store (MongoDB if `MONGODB_URI` is set and reachable, otherwise in-memory),
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
| `PUBLIC_APP_URL` | no | Public URL of the deployment |
| `MONGODB_URI`, `MONGODB_DB` | no | Set to persist data across restarts |
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
- Set `SESSION_SECRET` (and optionally `MONGODB_URI`).

### Docker

A production image is included (`Dockerfile`, `node_modules` excluded via `.dockerignore`):

```bash
docker build -t complylens-ai .
docker run -p 4000:4000 -e SESSION_SECRET="<long-random-string>" complylens-ai
# → http://localhost:4000   (health check: GET /api/health)
```

The image builds the client and server in a first stage and ships only `server/dist`, `client/dist` and production `node_modules`. Set `MONGODB_URI` to persist data in a volume-backed database, and `-e DEMO_MODE=false` for a private deployment.

### Vercel

Two workable patterns:

1. **Static client on Vercel + API elsewhere (Railway/Fly/VPS).**
   - Vercel project: root directory `client`, build command `npm run build`, output directory `dist`, environment variable `VITE_API_BASE_URL=https://api.example.com`.
   - API host: set `CORS_ORIGINS=https://your-app.vercel.app,https://your-preview-*.vercel.app` and `SESSION_SECRET`.
   - The API only emits CORS headers for allowlisted origins and never for wildcard credentials.

2. **Everything on Vercel** via a Node function that wraps the Express app (`server/dist/index.js` exports nothing today; add a thin `api/index.ts` handler). This works but is more moving parts than the single-service deployment, so pattern 1 or a container host is recommended.

Preview deployments and `localhost` both work without changes — nothing in the codebase is tied to a domain, and the client always calls its own origin unless `VITE_API_BASE_URL` is set.

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

## 5. Split deployment notes

- Build the client with `VITE_API_BASE_URL` pointing at the API origin.
- Set `CORS_ORIGINS` on the API to a comma-separated allowlist (`*` is supported for throwaway demos only).
- Tokens travel in the `Authorization` header; no cookies are used, which keeps cross-origin setups simple and CSRF-free by construction.
- `X-Frame-Options: SAMEORIGIN` is only sent in production. Development and preview environments omit it so the app can be embedded by a preview frame.

## 6. Operations

| Concern | Today | Production recommendation |
| --- | --- | --- |
| Persistence | In-memory store | Set `MONGODB_URI`, enable auth + TLS on the cluster, back up `evidence` and `reports` |
| Sessions | HS256 JWT with `SESSION_SECRET` | Store the secret in the platform's secret manager; rotate with a short overlap window |
| Rate limiting | Per-process fixed window (600/min/IP) | Replace with a shared store (Redis) when running more than one instance |
| Logging | Structured JSON lines to stdout | Ship stdout to your log platform; add request ids if you need tracing |
| Uploads | Parsed in memory, only the extracted text retained | Add object storage + antivirus scanning before accepting customer files at scale |
| Monitoring | `/api/health` | Point the platform health check at it; alert on 5xx rate |
| Migrations | Not applicable (schemaless demo) | Add migrations before changing stored shapes |

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `GET /` shows "ComplyLens AI API is running" | The client has not been built: run `npm run build`, or run in development mode |
| Everyone is signed out after a restart | `SESSION_SECRET` is not set |
| Uploads return 415/400 | Extension or size outside `ALLOWED_UPLOAD_TYPES` / `MAX_UPLOAD_MB` |
| Browser console shows CORS errors | The API origin is missing from `CORS_ORIGINS`, or the client was built with the wrong `VITE_API_BASE_URL` |
| Data disappears after redeploy | In-memory store: set `MONGODB_URI` |
| 429 responses under load | Rate limiter; raise the limit in `app.ts` or front the API with a CDN for static assets |
| PDF download returns 401 in a new tab | Use the app's download button (it sends the token) or append `?access_token=` |
