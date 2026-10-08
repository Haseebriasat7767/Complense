# Architecture

ComplyLens AI is a two-workspace TypeScript monorepo that runs as **one Node process**. The same process serves the JSON API and the web client, which removes CORS configuration, dual deployments and environment drift from the default setup.

```
┌──────────────────────────── one Node process (PORT=4000) ───────────────────────────┐
│                                                                                     │
│   Express app (server/src)                        Web client (client/)              │
│   ├─ /api/meta, /api/health      (public)         ├─ development: Vite middleware    │
│   ├─ /api/auth/*                 (public)         │    mounted inside Express (HMR)  │
│   ├─ /api/context, /api/dashboard…  (session)     └─ production: client/dist static   │
│   ├─ /api/evidence/*             (session)              + SPA history fallback       │
│   ├─ /api/controls, /api/mappings, /api/gaps… (session)                             │
│   ├─ /api/readiness, /api/reports/*, /api/organization… (session)                   │
│   └─ error handler (last)                                                           │
│                                                                                     │
│   store: in-memory (default) │ MongoDB (MONGODB_URI)                                │
│   analysis: deterministic engine │ optional AI provider for narrative only          │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Two entry points create that process, and both use the identical Express app from `server/src/app.ts`:

| Entry point | Used by |
| --- | --- |
| `server/src/index.ts` → `server/dist/index.js` | Local development, Docker, container hosts (serves API + built client) |
| `api/index.mjs` (Vercel function, see `vercel.json`) | Serverless deployment: Vercel serves `client/dist` from its CDN and the function receives `/api/*` with the original URL |

Neither entry point contains product logic, so a change to a route, the analysis engine or the PDF renderer takes effect in every deployment shape. `npm run verify:deploy` boots the serverless entry and exercises the API through it.

## Request flow (example: control detail page)

```
GET /app/controls/SOC2-CC6.1
  → Express: not /api → Vite middleware (dev) or static + SPA fallback (prod)
  → React Router renders ControlDetailPage
  → useApi('/api/controls/SOC2-CC6.1')
      → api.get() attaches the bearer token from localStorage
      → route: requireAuth() verifies the JWT, confirms the organisation exists
      → sessionOf(req) scopes the query to the caller's organisation
      → resolveWorkspace(req) resolves the workspace
      → store.listEvidence(org, workspace)
      → snapshotForFramework('soc2', evidence)
          → assessFramework()      deterministic item matching per control
          → mapEvidenceToControls() evidence → control links with confidence
          → buildFindings()        one finding per non-passing control
          → computeReadiness()     weighted readiness index
      → DTO mapping (server/src/http/dto.ts)
  → React renders status, evidence found/missing, analysis and recommendation
```

The client never re-computes product logic. Scores, statuses, findings and recommendations all come from the server so the dashboard, control pages, gap list and PDF can never disagree.

## Module responsibilities

### Server (`server/src`)

| Path | Responsibility |
| --- | --- |
| `config.ts` | Single place that reads environment variables, decides demo mode, loads `.env` via Node's built-in parser, and answers "is external AI enabled?" |
| `app.ts` | Express assembly: security headers → optional CORS → JSON body limit → rate limit → routers → `/api` 404 → (later) static/SPA → error handler |
| `index.ts` | Boots the store, creates the HTTP server, mounts Vite (dev) or static (prod), installs signal handlers |
| `dev/vite.ts` | Creates the Vite dev server in middleware mode and transforms `index.html` per request |
| `domain/` | Pure product logic: `controls.soc2.ts` + `controls.iso27001.ts` (the library), `frameworks.ts` (taxonomy), `analysis.ts` (matching + confidence), `findings.ts` (risk escalation + remediation), `scoring.ts` (readiness index), `evidence-seed.ts` (demo corpus), `reports.ts` (report assembly), `types.ts` (domain types) |
| `services/` | `extract.ts` (in-memory text extraction) and `readiness.ts` (`snapshotForFramework` — the single source of assessments, mappings, findings and score) |
| `routes/` | HTTP layer only: validate input, call the store/engine, map to DTOs. `auth`, `workspace`, `evidence`, `controls`, `gaps`, `reports`, `frameworks`, `meta` |
| `ai/` | Provider abstraction (`analyzeEvidence`, `writeNarrative`) with a deterministic default and an optional OpenAI-compatible provider |
| `pdf/report.ts` | pdfkit A4 renderer: cover page + 12 numbered sections + footer disclaimer |
| `http/` | `errors.ts` (`ApiError`, `errorHandler`, `notFoundHandler`), `security.ts` (headers, CORS, rate limit), `validate.ts` (body/query helpers), `dto.ts` (API shapes) |
| `store/` | `store.ts` (interface), `memory.ts` (default), `mongo.ts` (optional), `seed.ts` (demo seed), `index.ts` (factory with automatic fallback) |
| `auth/` | `tokens.ts` (HS256 sign/verify), `passwords.ts` (scrypt hash/verify), `middleware.ts` (`requireAuth`, `sessionOf`, `assertSameOrganization`) |
| `test/` | `demo-workspace.test.ts` (deterministic engine) and `api.test.ts` (HTTP integration on an ephemeral port) |

### Client (`client/src`)

| Path | Responsibility |
| --- | --- |
| `lib/api.ts` | Fetch wrapper (bearer token, JSON, `ApiError`, 401 → clear session), `useApi`, `useDebounced`, `buildQuery`, `downloadFile` |
| `lib/session.tsx` | `SessionProvider`: demo entry, login, signup, logout, workspace switch, context refresh |
| `lib/types.ts` | Client mirror of the server DTOs (kept in sync by convention) |
| `lib/utils.ts` | `cn`, status/risk/evidence/score tones, date and number formatting |
| `components/ui/` | Design-system primitives: buttons, cards, badges, inputs, feedback states, score visuals, overlays, toasts, tabs, dropdowns/tooltip |
| `components/app/` | `AppShell` (sidebar, top bar, mobile drawer, command palette), `PageHeader`, `ProtectedRoute` |
| `components/marketing/` | `MarketingLayout` (+ `DemoButton`, footer), dashboard preview mock, reusable sections (how it works, features, frameworks, security, pricing, FAQ) |
| `pages/` | `marketing/*`, `auth/*`, `app/*` route components, `NotFoundPage` |
| `styles/index.css` | All design tokens (colour scales, radii, shadows, motion) and shared utilities. Pages never invent their own palette |

## Design decisions and trade-offs

**One process, one port.** Simplest possible deployment and no CORS in the default path. `CORS_ORIGINS` exists for split hosting but is off by default.

**Derive, don't store.** Only user-mutable records are persisted (organisation, users, workspaces, evidence metadata + text, reports, audit events). Control statuses, mappings, findings, counts and scores are re-derived from the current evidence on every request. This guarantees consistency between every screen and the PDF, and removes a whole class of stale-data bugs.

**Deterministic engine first, AI second.** The assessment is rule-based and reproducible. An AI provider may only improve narrative wording — never the statuses, scores or mappings. This keeps the demo honest and lets the product run with no keys at all.

**In-memory by default, MongoDB optional.** The demo boots instantly with no services to run; persistence is opt-in. The Mongo store is loaded lazily so the `mongoose` dependency is genuinely optional and a connection failure degrades to memory instead of crashing.

**Minimal dependency surface.** Express, multer, pdfkit on the server (mongoose optional); React, Router, Recharts, lucide on the client; Tailwind for styling. Security headers, rate limiting, the `.env` loader and validation helpers are implemented in ~200 lines instead of pulling in helmet, express-rate-limit, dotenv and zod.

**Server-rendered PDFs.** The report is rendered by pdfkit on the server from the same snapshot the UI shows, then streamed to the browser. No client-side PDF library, no duplicated report logic.

**Colour only for semantics.** The interface is neutral slate; teal is the single accent; green/amber/red/blue are reserved for status meaning (passed / needs attention / missing / informational).

## Extension points

- **New framework** — add a control list module, register it in `domain/frameworks.ts`, and every screen, filter and report picks it up.
- **New evidence format** — implement a branch in `services/extract.ts`; the rest of the pipeline is text-based.
- **Real AI** — implement `ai/providers/*` and set `AI_PROVIDER`/`AI_API_KEY`/`AI_ALLOW_EXTERNAL`.
- **Persistence** — implement the `Store` interface (see `store/store.ts`) for Postgres or another database; nothing else changes.
- **Document parsing/OCR** — replace or augment `services/extract.ts`; documents without a reliable text layer are already surfaced as *needs review* rather than silently accepted.
