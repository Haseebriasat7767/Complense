# MongoDB → Supabase PostgreSQL

ComplyLens AI now stores everything in **Supabase PostgreSQL**. MongoDB and
Mongoose have been removed from the application, the dependencies and the
configuration. This document records what changed and how to bring existing
data across.

---

## What changed

| Before | After |
| --- | --- |
| `MONGODB_URI`, `MONGODB_DB` | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (+ optional `SUPABASE_DB_SCHEMA`, `SUPABASE_EVIDENCE_BUCKET`, `SUPABASE_TIMEOUT_MS`, `EVIDENCE_RETAIN_ORIGINAL_FILES`, `STORE_DRIVER`) |
| `server/src/store/mongo.ts` (Mongoose models) | `server/src/store/supabase.ts` + `supabase-client.ts` |
| `mongoose` optional dependency | `@supabase/supabase-js` dependency |
| Schemaless collections | Version-controlled SQL in `supabase/migrations/` with FKs, indexes, check constraints and RLS |
| Mongo failure → silent in-memory fallback | Production fails fast with an error naming the missing variables; **no** memory fallback |
| `/api/health` reported the store kind only | `/api/health` reports `database.connected` from a real query and returns **503** when the production database is unreachable |
| Uploaded file bytes discarded after extraction | Original bytes retained in a **private** Supabase Storage bucket, downloadable only via `GET /api/evidence/:id/file` |

The API response shapes, the UI, the authentication behaviour, the scrypt
password hashing and the HS256 session signing are unchanged. `/api/health`
and the evidence DTO gained **additional** fields; nothing was removed.

### Field mapping

| Mongo collection / field | PostgreSQL table / column |
| --- | --- |
| `organizations._id` | `organizations.id` (text) |
| `organizations.primaryFramework` | `organizations.primary_framework` |
| `organizations.employeeCount` | `organizations.employee_count` |
| `organizations.settings` | `organizations.settings` (`jsonb`) |
| `workspaces.organizationId` / `isDemo` / `isDefault` / `ownerUserId` | `workspaces.organization_id` / `is_demo` / `is_default` / `owner_user_id` |
| `users.jobTitle` / `isDemoUser` / `passwordHash` / `lastLoginAt` | `users.job_title` / `is_demo_user` / `password_hash` / `last_login_at` |
| `evidence.fileName` / `fileExtension` / `mimeType` / `sizeBytes` / `frameworkKeys` / `sourceRef` / `uploadedAt` / `uploadedBy` | `evidence.file_name` / `file_extension` / `mime_type` / `size_bytes` / `framework_keys` (`text[]`) / `source_ref` / `uploaded_at` / `uploaded_by` |
| *(new)* | `evidence.storage_bucket`, `evidence.storage_path` |
| `reports.frameworkKey` / `companyName` / `generatedAt` / `scoreIndex` / `summary` / `requestedBy` | `reports.framework_key` / `company_name` / `generated_at` / `score_index` / `summary` (`jsonb`) / `requested_by` |
| `auditevents.*` | `audit_events.*` (no FK — see `docs/DATABASE.md`) |

Password hashes are copied **verbatim**. Nothing is decoded, re-hashed or
weakened, so every existing login keeps working.

---

## Existing data does not move by itself

Nothing reads your MongoDB deployment unless you explicitly configure it. If
the old data is worth keeping, run the optional one-time import below. If it is
not (for example, it only contained the demo workspace), skip it: the Supabase
store reseeds the demo workspace on first boot.

### One-time import

**Prerequisites**

1. Apply the schema first: `npm run db:migrate` (or `supabase db push`).
2. Install the Mongo driver temporarily — it is deliberately *not* a project
   dependency:

   ```bash
   npm install --no-save mongodb
   ```

**Dry run (default — writes nothing):**

```bash
MONGODB_URI="mongodb+srv://…" \
MONGODB_DB="complylens" \
SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SECRET_KEY="<secret key>" \
  npm run db:migrate:mongo
```

**Apply:**

```bash
MONGODB_URI="mongodb+srv://…" \
MONGODB_DB="complylens" \
SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SECRET_KEY="<secret key>" \
  npm run db:migrate:mongo -- --apply
```

Properties of the script (`scripts/migrate-mongo-to-supabase.mjs`):

- refuses to run unless every required variable is set — it never guesses a
  connection string;
- inserts with `on conflict (id) do nothing`, so re-running never overwrites a
  row that already exists in Supabase;
- copies ids verbatim, so every existing reference keeps resolving;
- prints progress only — no credential is ever logged;
- imports in dependency order (organisations → workspaces → users → evidence →
  reports → audit events).

MongoDB never stored the original uploaded bytes, so there is nothing to move
into Supabase Storage. Imported evidence keeps its extracted text; files
uploaded after the migration also keep their original file.

**Afterwards:** `npm uninstall mongodb` (or simply drop the `--no-save`
install), and decommission the MongoDB cluster once you have verified the data
in Supabase.

---

## Verification checklist

```bash
curl -s https://<deployment>/api/health | jq '.database'
# { "kind": "supabase", "connected": true, "persistent": true, … }
```

1. Sign in and confirm your organisations, users, evidence and reports appear.
2. Upload a PDF, refresh the page — it is still listed.
3. Redeploy, refresh again — it is still listed (this is the check that proves
   the store is no longer per-instance).
4. Download the original file from the evidence detail page.
5. Confirm a user from another organisation gets a 404 for that evidence id.
