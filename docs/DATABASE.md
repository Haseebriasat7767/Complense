# Database

## Production database

ComplyLens production uses Supabase PostgreSQL through the server-side Supabase Data API. The application has eight primary tables:

- `organizations`
- `workspaces`
- `users`
- `evidence`
- `reports`
- `audit_events`
- `remediations`
- `remediation_events`

The schema and indexes are versioned under `supabase/migrations/`. Keep the migration files and the live project's migration history aligned.

## Access model

All application tables have Row Level Security enabled. The current design does not grant direct table SELECT privileges to Supabase `anon` or `authenticated` roles. The ComplyLens server uses the server-only `SUPABASE_SECRET_KEY` to access the Data API.

Because the server-side secret role bypasses RLS, all application operations must enforce organization/workspace scoping. Do not expose the secret key in client code and do not add public table grants to make browser requests work.

## Persistence behaviour

- Production: Supabase is mandatory. Startup verifies the required tables and fails closed if the database is unavailable.
- Local development and tests: MemoryStore may be used when Supabase credentials are absent.
- Production never silently falls back to in-memory storage.

Evidence content is stored as extracted text and metadata. Application-layer field encryption, malware scanning and automated retention purges are not currently implemented; see [SECURITY.md](SECURITY.md).

## Data ownership and audit

Evidence rows record the uploader user ID and retain uploader display information separately. Reports store a snapshot of readiness at generation time. Remediation plans and their event history are persisted in their dedicated tables.

The audit/event records are useful application history but are not currently immutable or tamper-evident.
