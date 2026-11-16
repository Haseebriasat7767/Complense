# Production deployment

ComplyLens is a full-stack React client and Express API. The production deployment uses Vercel Services for the application and Supabase PostgreSQL for persistent data.

## Production architecture

- **Client service:** Vite-built React application from the `client` directory.
- **Server service:** Express API from the repository root, routed through the Vercel service binding configured in `vercel.json`.
- **Database:** Supabase PostgreSQL via the server-side Data API.
- **Authentication:** ComplyLens signed sessions; production requires a persistent `SESSION_SECRET` and authenticated access.
- **Secrets:** Supabase secret key and any AI/billing credentials are server-only. Never put them in `VITE_*` variables or client bundles.

The current Vercel project is configured for Node.js 24.x. The application supports Node.js 22.12+ for local builds.

## Required production environment

Set these variables on the Vercel **Production** environment:

| Variable | Requirement | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Production runtime |
| `SESSION_SECRET` | Required | High-entropy random secret; keep stable across deployments and instances |
| `AUTH_REQUIRED` | `true` | Require authenticated sessions |
| `DEMO_MODE` | `false` | Disable passwordless demo access in production |
| `SUPABASE_URL` | Required | HTTPS URL for the production Supabase project |
| `SUPABASE_SECRET_KEY` | Required | Supabase server-side secret key; never expose to browsers |
| `AI_PROVIDER` | Optional | Defaults to deterministic analysis |
| `AI_API_KEY` | Optional | Only needed for a supported external provider |
| `AI_ALLOW_EXTERNAL` | Optional | Must be explicitly enabled before evidence text is sent to an external AI provider |

Do not copy production database credentials into Preview. Use an isolated Supabase project/branch and test credentials for previews. Never point an unreviewed preview deployment at customer production data.

## Fail-closed storage behaviour

Production startup requires both Supabase variables and verifies all required application tables. If credentials are missing, a table is unavailable, or the database cannot be reached, startup aborts. Production does **not** silently switch to MemoryStore: that would make writes appear successful while data disappears between instances or restarts.

MemoryStore is reserved for local development and automated tests.

The health endpoint is `GET /api/health`. A healthy production response must identify the store as `supabase`; an HTTP response alone is not sufficient—confirm the reported store kind and database health detail.

## Database migrations and access model

Apply migrations in `supabase/migrations/` in version order and keep the repository migration history aligned with the live Supabase project's migration history. Current production migration history includes:

- `20261009172407` — initial ComplyLens schema
- `20261107203701` — remediation tables
- `20261108005730` — evidence uploader attribution
- `20261116123537` — remediation service-role grants and uploader hardening
- `20261116124052` — revoke public execution of the internal RLS helper
- `20261116124417` — Stripe billing metadata

All eight application tables have RLS enabled. The current access design intentionally gives `anon` and `authenticated` no direct table SELECT privileges; the server uses the Supabase secret key and applies organization/workspace scoping in application queries. Because the server-side secret role bypasses RLS, route-level authorization and tenant-scoped store queries are security-critical. Do not add public grants or broad RLS policies merely to silence the Supabase advisor.

After schema changes, run Supabase security and performance advisors and inspect table grants, policies, indexes and migration history.

## Build and verification

Run the following from the repository root:

```bash
npm ci
npm audit --omit=dev --audit-level=low
npm run typecheck
npm test
npm run build
npm run verify:deploy
```

CI must fail on production dependency vulnerabilities, failed tests or failed builds. Do not treat a Vercel `READY` preview as proof that persistence, authentication or the PDF workflow works.

## Vercel release process

1. Review the exact commit and all changed migrations.
2. Require the CI audit, test and build gates to pass.
3. Deploy a Preview using isolated non-production data.
4. Verify sign-up/login, authorization, PDF upload, extraction, report generation, remediation creation/update/events, refresh and re-login.
5. Confirm the expected rows exist in the isolated Supabase database and that another organization cannot read or modify them.
6. Promote only the reviewed commit after the above checks pass.
7. After release, check health, application errors and Supabase logs.

The current application has a 4 MB upload limit in Vercel environments. PDF text extraction is not OCR: scanned/image-only PDFs must be marked for manual review rather than treated as successfully analyzed.

## Operational limitations to close before handling sensitive customer evidence

- No independent penetration test has been completed.
- Application-layer field encryption for extracted evidence is not implemented.
- Malware scanning/content disarm and OCR are not implemented.
- Rate limiting is process-local rather than shared across all instances.
- Password reset email delivery is not configured.
- Retention preferences do not yet drive an automated deletion job.
- Billing UI and payment flows must be verified separately before offering paid self-service subscriptions.

These limitations must be disclosed. A working production deployment is not equivalent to a SOC 2/ISO certification or an independent security assessment.
