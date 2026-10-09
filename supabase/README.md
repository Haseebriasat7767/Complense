# Supabase setup

ComplyLens AI stores all persistent data in **Supabase PostgreSQL**. This folder
holds the version-controlled SQL that creates the schema, the indexes, the
constraints, the Row Level Security policies and the private evidence bucket.

```
supabase/
└─ migrations/
   ├─ 20261009000100_init_core_schema.sql        tables, FKs, indexes, RLS
   └─ 20261009000200_evidence_storage_bucket.sql private "evidence" bucket
```

Migrations are **append-only**: never edit a file that has already been applied,
add a new one instead (`npm run db:migrate` refuses a changed checksum).

---

## 1. Create the project

1. <https://supabase.com/dashboard> → **New project**.
2. Pick a region close to your Vercel region and store the database password in
   your password manager. You will not need to paste it anywhere in this repo.

## 2. Apply the migrations

Pick **one** of the three options. All are equivalent.

### Option A — Supabase CLI (recommended)

```bash
npm install -g supabase            # or: brew install supabase/tap/supabase
supabase link --project-ref <your-project-ref>
supabase db push
```

### Option B — the script in this repository

```bash
# Project Settings → Database → Connection string → URI (port 5432)
export DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres"
npm run db:migrate
```

Connection-mode notes:

| Mode | Host / port | Use it for |
| --- | --- | --- |
| Direct | `db.<ref>.supabase.co:5432` | Migrations (DDL). Requires IPv6 or the IPv4 add-on. |
| Session pooler | `aws-0-<region>.pooler.supabase.com:5432` | Migrations from an IPv4-only network. |
| Transaction pooler | `…:6543` | **Not** for migrations — no prepared statements, no multi-statement DDL transactions. |

SSL is required; the script enables TLS automatically for any non-localhost host.
The script records applied files in `public.schema_migrations`, so it is safe to
re-run.

### Option C — SQL editor

Open each file in `supabase/migrations/` **in filename order** and run it in the
Supabase SQL editor. The files are idempotent (`if not exists`, `on conflict`).

## 3. Verify

In the Supabase dashboard:

- **Table editor** shows `organizations`, `workspaces`, `users`, `evidence`,
  `reports`, `audit_events`, each with the green **RLS enabled** badge.
- **Storage** shows a bucket named `evidence` with **Public = false**.

## 4. Collect the two server-side variables

| Variable | Where | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Project Settings → Data API → Project URL | `https://<ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys → **secret** key (`sb_secret_…`, previously “service_role”) | **Server-side only.** Never `VITE_`/`NEXT_PUBLIC_`. |

Add them to Vercel (Project → Settings → Environment Variables) — see the README
section “Deploy to Vercel”. Never commit them, never paste them in a chat.

---

## Security model

| Layer | Control |
| --- | --- |
| Browser | Never talks to Supabase. The React client only calls `/api/*` on its own origin. No Supabase key is included in the client bundle. |
| Data API (PostgREST) | RLS is **enabled** on all six tables and all privileges are **revoked** from `anon` and `authenticated`, so a leaked publishable key reads nothing. A `RESTRICTIVE` policy additionally requires a server-set `request.complylens_org` claim, so an accidentally added permissive policy still cannot expose cross-tenant rows. |
| Backend | Uses the secret (service role) key, which bypasses RLS by design. Every query in `server/src/store/supabase.ts` filters on `organization_id` (and `workspace_id` where relevant), so tenancy is enforced in the SQL, not only in the UI. The session token is verified first (`server/src/auth/middleware.ts`). |
| Storage | The `evidence` bucket is private, has no public URL and has no policy for `anon`/`authenticated`. Object keys contain 32 random hex characters. Downloads go through `GET /api/evidence/:id/file`, which re-reads the row with the caller's `organization_id` before streaming. |
| Logs | `sanitizeDbError()` strips URLs, `sb_secret_…`/JWT-shaped values, passwords and API keys from every message that reaches a log or an HTTP response. |

RLS is deliberately **not** `FORCE`d: the backend's `service_role` bypasses RLS
anyway, and forcing it would break the SQL editor and the one-time Mongo import,
which connect as the table owner — without protecting against the threat that
matters (a browser-held key reaching PostgREST).

## Resetting a development project

```sql
-- DESTRUCTIVE. Never run this against production.
drop table if exists public.audit_events, public.reports, public.evidence,
                     public.users, public.workspaces, public.organizations cascade;
drop table if exists public.schema_migrations;
```

Then re-apply the migrations.
