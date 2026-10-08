# Database model

ComplyLens AI has two storage modes behind one interface (`server/src/store/store.ts`):

| Mode | When | Behaviour |
| --- | --- | --- |
| **In-memory** (default) | `MONGODB_URI` is empty, or mongoose/connection fails | Deterministic demo workspace is seeded on boot; changes live for the lifetime of the process |
| **MongoDB** (optional) | `MONGODB_URI` is set and mongoose loads | The same seed runs once; all mutations persist |

Both modes implement the same methods, so route and domain code is storage-agnostic.

## Stored collections

Only **user-mutable** records are stored. Control statuses, mappings, findings, readiness scores, dashboards and reports' numbers are re-derived from evidence on each request — see [`ARCHITECTURE.md`](ARCHITECTURE.md#design-decisions-and-trade-offs).

### `organizations`

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
| `status` | `'analyzed' \| 'analyzing' \| 'needs_review' \| 'failed'` | Re-derived if a record is stuck in `analyzing` for more than 2 minutes |
| `frameworkKeys` | string[] | Which frameworks the document can evidence |
| `content` | string | Extracted text — uploads are parsed in memory and only the text is retained |
| `summary` | string | Deterministic summary (or AI-assisted wording when configured) |
| `sizeOnDisk`, `createdByUser` | optional | Reserved for a future object-storage integration |

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

### `auditEvents`

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

- 1 organisation (`org_acmecloud`, AcmeCloud — labelled "Demo Data"), 1 workspace (`ws_acmecloud_demo`, "Demo Workspace")
- 2 users: `demo@complylens.ai` / `DemoPass123!` (owner) and `analyst@complylens.ai` / `AnalystPass123!` (member)
- 10 evidence documents: the eight named samples, `Vendor_Security_Questionnaire_Q3.pdf` (*needs review*), `Legacy_Data_Flow_Diagram.pdf` (*failed* — no extractable text)
- 2 audit events, and one SOC 2 report snapshot so the reports page is never empty

Seeding is idempotent, and the same corpus always produces SOC 2 **92%** and ISO/IEC 27001 **78%**.

## MongoDB notes

- Collections use string `_id` values (the ids above), `versionKey: false`, and indexes on `organizationId`.
- The schema is intentionally loose (`Object` for nested structures such as `settings` and `summary`) so the demo DTOs can evolve without migrations.
- `MongoStore.connect()` is attempted lazily; if the connection or `init()` fails the app logs a warning and continues on the in-memory store, so an unavailable database never breaks the demo.
- A production deployment should tighten validation (JSON schema/mongoose validators), enable authentication/TLS on the connection string, and back up the `reports` and `evidence` collections.
