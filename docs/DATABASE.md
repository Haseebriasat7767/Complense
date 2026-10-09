# Database model

ComplyLens AI has two storage modes behind one interface (`server/src/store/store.ts`):

| Mode | When | Behaviour |
| --- | --- | --- |
| **Supabase PostgreSQL** (production) | `SUPABASE_URL` + `SUPABASE_SECRET_KEY` are set (or `STORE_DRIVER=supabase`) | The demo seed runs once if absent; all mutations persist |
| **In-memory** (local/test only) | Supabase is not configured and `NODE_ENV != production` | Deterministic demo workspace seeded on boot; changes live for the lifetime of the process |

In **production** the in-memory store is refused outright: a missing or
unreachable database aborts startup instead of silently discarding customer
data (`resolveStoreDriver()` in `server/src/config.ts`,
`initStore()` in `server/src/store/index.ts`).

Both modes implement the same methods, so route and domain code is storage-agnostic.

The SQL that creates everything below lives in
[`../supabase/migrations/`](../supabase/migrations) and is applied with
`supabase db push` or `npm run db:migrate` — see
[`../supabase/README.md`](../supabase/README.md).

## Identifiers

Primary keys are **TEXT**, not UUID. The application already issues readable,
prefixed ids that are part of the API contract and of the deterministic demo
seed:

| Entity | Example |
| --- | --- |
| Organisation | `org_acmecloud`, `org-7f3a1b2c4d5e` |
| Workspace | `ws_acmecloud_demo`, `ws-7f3a1b2c4d5e` |
| User | `usr-demo-owner`, `usr-7f3a1b2c4d5e` |
| Evidence | `ev-demo-access-control-policy`, `ev-<16 hex>` |
| Report | `rpt-<12 hex>` |
| Audit event | `aud-<16 hex>` |

Switching to UUID would break existing links, the seed and client state, so the
schema stores them as TEXT.

Timestamps are `timestamptz` in PostgreSQL and are converted back to the exact
ISO-8601 `…T…:…:….sssZ` strings the API has always returned, so no response
shape changed in this migration.

## Stored tables

Only **user-mutable** records are stored. Control statuses, mappings, findings, readiness scores, dashboards and reports' numbers are re-derived from evidence on each request — see [`ARCHITECTURE.md`](ARCHITECTURE.md#design-decisions-and-trade-offs).

### `organizations`

Columns are snake_case in PostgreSQL; the adapter maps them to the camelCase domain model.


| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Demo seed uses `org_acmecloud` |
| `name`, `slug` | string | Shown on the report cover page |
| `plan` | `'starter' \| 'growth' \| 'business'` | Demo pricing tiers |
| `primaryFramework` | `'soc2' \| 'iso27001'` | Default framework for the dashboard |
| `industry`, `employeeCount` | string, number | Scoping guidance only |
| `createdAt` | ISO string | |
| `settings` | object | `defaultFramework`, `monthlyDigest`, `gapAlerts`, `reportReadyEmails`, `uploadNotifications`, `mfaRequired`, `sessionTimeoutMinutes`, `retentionDays`, `allowedUploadTypes[]` |

### `workspaces`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Demo seed uses `ws_acmecloud_demo` |
| `organizationId` | string | Indexed; every query is scoped by this |
| `name` | string | Renamatble from Settings |
| `isDemo` | boolean | Marks the seeded sample workspace ("Demo Data") |
| `isDefault` | boolean | |
| `createdAt` | ISO string | |
| `ownerUserId` | string | |

### `users`

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `organizationId` | string | |
| `email` | string | Unique, lower-cased |
| `name`, `jobTitle` | string | |
| `role` | `'owner' \| 'admin' \| 'member'` | Owners/admins may write organisation settings |
| `isDemoUser` | boolean | Seeded personas are demo users |
| `passwordHash` | string | `scrypt` — format `scrypt$<salt>$<hash>`; never returned by the API |
| `createdAt`, `lastLoginAt` | ISO string | |

### `evidence`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `ev-demo-<key>` for samples, `ev-<hex>` for uploads |
| `organizationId`, `workspaceId` | string | Both indexed |
| `fileName`, `fileExtension`, `mimeType`, `sizeBytes` | | |
| `category` | string | One of the control categories (used by filters and mapping) |
| `source` | `'demo' \| 'upload'` | Everything `demo` is labelled "Demo Data" in the UI |
| `sourceRef` | string? | Demo document key |
| `uploadedAt`, `uploadedBy` | ISO string | |
| `status` | `'analyzed' \| 'analyzing' \| 'needs_review' \| 'failed'` | Legacy `analyzing` records are conservatively settled after 2 minutes: non-empty retained text becomes `needs_review`, empty/failure-note text becomes `failed`. Re-analysis never promotes an extraction status. |
| `frameworkKeys` | string[] | Which frameworks the document can evidence |
| `content` | string | Extracted text — uploads are parsed in memory and only the text is retained |
| `summary` | string | Deterministic summary (or AI-assisted wording when configured) |
| `sizeOnDisk`, `createdByUser` | optional | Reserved |
| `storage_bucket`, `storage_path` | optional | Reference to the ORIGINAL uploaded file in the private Supabase Storage bucket. Never a public URL; never returned to the browser. A unique partial index prevents two rows pointing at the same object |

### `reports`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `rpt-<hex>` |
| `organizationId`, `workspaceId` | string | |
| `name`, `fileName` | string | `fileName` is used in the `Content-Disposition` header |
| `frameworkKey` | `'soc2' \| 'iso27001'` | |
| `companyName` | string | Snapshot of the organisation name |
| `generatedAt` | ISO string | |
| `status` | `'generating' \| 'ready' \| 'failed'` | |
| `scoreIndex` | number | Readiness index at generation time |
| `requestedBy` | string | User email or "ComplyLens sample data" |
| `summary` | object | `executiveSummary`, `readiness {index, band, bandLabel, counts, components, openFindings, methodology}`, `criticalFindings[]`, `highFindings[]`, `recommendations[]`, `evidenceInventory[]`, `categoryBreakdown[]`, `conductedBy`, `analysisMode`, `disclaimer` |

### `audit_events`

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `organizationId` | string | |
| `actor` | string | User email |
| `action` | string | e.g. `report.generated`, `organization.updated`, `workspace.renamed` |
| `target` | string | Human-readable subject |
| `at` | ISO string | |

## Relationships

```
Organization 1 ── n Workspace 1 ── n Evidence
      │                 └──────── n Report
      └── n User
      └── n AuditEvent
```

There are no cross-organisation references: every query includes `organizationId`, enforced by `sessionOf(req)` in `auth/middleware.ts`.

## Derived (never stored) data

| Concept | Derived from | Where |
| --- | --- | --- |
| Control assessment status, confidence, matched/missing items | Control library + evidence text | `domain/analysis.ts` |
| Evidence → control mappings | Control library + evidence text | `domain/analysis.ts` |
| Findings, risk escalation, remediation guidance | Assessments + control definitions | `domain/findings.ts` |
| Readiness index and components | Assessments + findings | `domain/scoring.ts` |
| Dashboard, gap list, framework readiness, report contents | The snapshot helpers | `services/readiness.ts` |

## Seed data

`store/seed.ts` calls `buildDemoEvidence()` and inserts:

- 1 organisation (`org_acmecloud`, AcmeCloud — labelled "Demo Data"), 1 workspace (`ws_acmecloud_demo`, "AcmeCloud Demo Workspace")
- 2 users: `demo@complylens.ai` / `DemoPass123!` (owner) and `analyst@complylens.ai` / `AnalystPass123!` (member)
- 10 evidence documents: the eight named samples, `Vendor_Security_Questionnaire_Q3.pdf` (*needs review*), `Legacy_Data_Flow_Diagram.pdf` (*failed* — no extractable text)
- 2 audit events, and one SOC 2 report snapshot so the reports page is never empty

Seeding is idempotent, and the same corpus always produces SOC 2 **92%** and ISO/IEC 27001 **78%**.

## PostgreSQL notes

- Every table has a TEXT primary key, `created_at`/`updated_at` timestamps and an `updated_at` trigger (`public.set_updated_at`).
- `workspaces`, `users`, `evidence` and `reports` carry `organization_id` with `references public.organizations (id) on delete cascade`; `evidence` and `reports` also cascade from `workspaces`.
- `audit_events` deliberately has **no** foreign key: `POST /api/auth/forgot-password` records an event with `organization_id = 'unknown'` for an address that does not exist, and a FK failure there would leak account existence.
- `users` has a unique index on `lower(email)`; `workspaces` has a partial unique index enforcing at most one default workspace per organisation.
- Enum-like columns (`plan`, `role`, `status`, `source`, `framework_key`, `primary_framework`) are constrained with `check` constraints, so bad data cannot be written even by a direct SQL session.
- `settings` and `summary` are `jsonb`; `framework_keys` is `text[]` constrained to `{soc2, iso27001}`.
- Indexes cover the hot paths: `(organization_id, workspace_id, uploaded_at desc)` on evidence, `(organization_id, workspace_id, generated_at desc)` on reports, `(organization_id, at desc)` on audit events.

## Row Level Security

| Role | Access |
| --- | --- |
| `anon`, `authenticated` (browser keys) | **None.** RLS is enabled on all six tables and every privilege is revoked. A `RESTRICTIVE` policy additionally requires a server-set `request.complylens_org` claim. |
| `service_role` (the backend) | Full access — it bypasses RLS by design. Tenancy is enforced by the application: every query in `server/src/store/supabase.ts` filters on `organization_id`, after `requireAuth()` has verified the session token. |

The ComplyLens browser bundle contains no Supabase key and no Supabase SDK; it
only calls `/api/*` on its own origin.

## Evidence files

Uploads are parsed in memory. The extracted text and metadata go to the
`evidence` table; the original bytes go to the private `evidence` Storage
bucket at

```
org/<organizationId>/ws/<workspaceId>/<evidenceId>-<32 hex chars>.<ext>
```

The random suffix makes an object key unguessable even for someone who knows
the evidence id. There is no public URL: `GET /api/evidence/:id/file`
authenticates the session, re-reads the row scoped to the caller's
organisation, and only then streams the object. A failed upload is compensated
in both directions, so neither an orphaned row nor an orphaned object is left
behind.

Set `EVIDENCE_RETAIN_ORIGINAL_FILES=false` to keep the previous behaviour
(extracted text only).

## Migrating from the previous MongoDB build

MongoDB records do not appear in Supabase automatically. See
[`MIGRATION-MONGODB-TO-SUPABASE.md`](MIGRATION-MONGODB-TO-SUPABASE.md) for the
optional, idempotent one-time import.
