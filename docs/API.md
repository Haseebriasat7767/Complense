# API reference

Base URL: the same origin as the web app. All routes live under `/api`.
Content type is `application/json` unless stated otherwise.

## Conventions

- **Authentication** — send `Authorization: Bearer <token>`. Routes marked *session* call `requireAuth()`, resolve the caller's organisation and scope every query to it. Query-string bearer tokens are not accepted.
- **Errors** — failures return `{ "error": { "code": "…", "message": "…" } }`; a `details` field is included only when present. Common codes: `bad_request` (400), `invalid_json` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404), `payload_too_large` (413), `unsupported_media_type` (415), `rate_limited` (429), `internal_error` (500). Messages are safe for users — no stack traces or internal details.
- **Rate limiting** — 600 requests/minute per Express `req.ip` on `/api` (fixed window); authentication attempts have an additional 30-per-10-minute limit. `X-RateLimit-*` and `Retry-After` headers are set. Forwarded addresses are ignored unless `TRUST_PROXY_HOPS` is set to the exact trusted proxy count.
- **Workspace scoping** — session routes accept an optional `?workspaceId=`; omitted, the demo workspace (or the caller's default workspace) is used.
- **Demo mode** — with `AUTH_REQUIRED=false` the app is fully explorable, but every session route still requires a token. `POST /api/auth/demo` issues one instantly.

---

## Public routes

### `GET /api/health`
Liveness and store information.

```json
{ "status": "ok", "product": "ComplyLens AI", "version": "0.1.0", "time": "…", "uptimeSeconds": 42,
  "store": { "kind": "memory", "detail": "In-memory demo store — 10 evidence records, 2 users." } }
```

### `GET /api/meta`
Product metadata used by the marketing site and the in-app disclosures: framework list with control and category counts, the active analysis mode and scoring weights, upload limits, demo-mode/auth flags and the disclaimer strings.

### `GET /api/frameworks`
The framework catalogue with category names (public summary of `/api/readiness`).

### `POST /api/auth/signup`
Body: `{ name, email, password, organizationName, jobTitle?, industry?, seedDemo? }` (`seedDemo` defaults to `true`).
`201` → `{ token, expiresAt, user, organization, workspace, workspaces, persistence }`. Validation problems return `400` with a field message.

### `POST /api/auth/login`
Body: `{ email, password }` → `200` with the session payload. A wrong password returns `401` `"Email or password is incorrect."` (identical message for unknown accounts).

### `POST /api/auth/demo`
No body. Issues a signed session for the seeded demo owner → `200` with `token`, `expiresAt`, `user` (`isDemoUser: true`), `organization`, `workspace` (`isDemo: true`), `workspaces[]` and `persistence`.

### `POST /api/auth/logout`
Stateless: returns `{ ok: true, message: 'Signed out.' }`; the client clears its stored session.

### `POST /api/auth/forgot-password`
Body: `{ email }` → `{ ok: true, emailDeliveryEnabled: false, message }`. No email is sent in the demo build; the response is deliberately identical for known and unknown addresses so it cannot enumerate accounts.

### `GET /api/auth/session` *(session)*
Re-validates the token and returns the current session payload (used on app boot).

---

## Workspace routes *(session)*

### `GET /api/context`
Everything the app shell needs: `user`, `organization`, `workspace`, `workspaces[]`, `demoMode`, `analysisMode {key, label}`.

### `GET /api/dashboard?framework=soc2|iso27001`
The dashboard payload:

| Key | Contents |
| --- | --- |
| `workspace`, `organization` | Current scope |
| `greeting` | `{ period, label, name }` |
| `generatedAt`, `analysisMode`, `framework` | Metadata |
| `metric` | `{ readinessIndex, bandLabel, components[], methodology }` |
| `counts` | `{ total, reviewed, passed, needsAttention, missing, needsReview }` |
| `findings` | `{ critical, high, medium, low, total }` |
| `frameworks[]` | Both frameworks with index, band, counts and label |
| `priorityFindings[]` | 3–5 top findings (full finding shape) |
| `recentEvidence[]` | Newest documents |
| `coverage` | `{ total, analyzed, needsReview, failed, analyzing, distinctControlsCovered, unmappedDocuments[] }` |
| `categories[]` | Per-category control counts by status |
| `topControl` | The highest-risk control, with its finding id |
| `activity` | `{ workspaceName, openFindings, items[] }` |

### `GET /api/activity`
`{ items: [{ id, type, label, detail, at }], total }` — recent workspace activity.

### `PATCH /api/organization` *(owner/admin)*
Body accepts any of `name`, `industry`, `employeeCount`, `primaryFramework`, and a `settings` object (`defaultFramework`, `monthlyDigest`, `gapAlerts`, `reportReadyEmails`, `uploadNotifications`, `mfaRequired`, `sessionTimeoutMinutes` 5–480, `retentionDays` 30–2555, `allowedUploadTypes[]`). Returns `{ organization }`. Members receive `403`.

### `PATCH /api/workspace`
Body `{ name }` → `{ workspace }`.

---

## Evidence routes *(session)*

### `GET /api/evidence`
Query: `status`, `framework`, `category`, `search`.
Returns `{ items[], total, categories[], uploads {maxBytes, maxLabel, allowedExtensions}, analysisMode {label} }`.
Each item: `id, fileName, fileExtension, mimeType, sizeBytes, sizeLabel, category, source, uploadedAt, uploadedBy, status, frameworkKeys, summary, mappedControlCount, mappedControls[], textExcerpt`.

### `GET /api/evidence/categories?framework=…`
Category options for the upload form.

### `GET /api/evidence/:id`
Evidence detail: the item plus `extractedText`, `mapping[]` (control code/name, confidence, matched and missing items) and `isDemoSample`.

### `GET /api/evidence/:id/text`
Returns a `text/plain` snapshot of the retained extracted text (`Content-Disposition: inline`). The source upload itself is not retained.

### `POST /api/evidence` *(multipart/form-data)*
Field `file` (required), plus optional `category` and `frameworks` (`soc2`, `iso27001`, or both). Validates extension (default `pdf,docx,txt,csv`) and size (default 10 MB) — an unsupported type returns `415`, an oversized file `413`. Files are parsed in memory; only extracted text and metadata are retained. TXT/CSV text is read directly; PDF/DOCX extraction is a lightweight text-layer heuristic, not full document conversion or OCR. Unreadable files remain `failed`, and partial text is `needs_review`. Returns `201 { evidence, extraction, analysis, message }`; the evidence object includes mapped controls.

### `POST /api/evidence/:id/analyze`
Re-runs analysis over text already retained for the document and refreshes its summary/mappings. It does **not** re-parse the original file or run OCR, and it does not promote `failed` or `needs_review` extraction status → `{ evidence, message }`.

### `PATCH /api/evidence/:id`
Supports metadata fields `{ category?, frameworks?, summary?, fileName? }` → `{ evidence }`. Analysis status cannot be set directly.

### `DELETE /api/evidence/:id`
Returns `200 { ok, deletedId, message }`. The record, its retained text and (when Supabase Storage is enabled) the original file object are removed. In memory mode a fresh process reseeds the demo workspace; with Supabase the deletion is permanent.

---

## Control and mapping routes *(session)*

### `GET /api/controls`
Query: `framework` (`soc2|iso27001`), `status`, `risk`, `category`, `search`, `sort` (`priority` default, `code`, `category`, `confidence`), `limit` (1–500, default 200).
Returns `{ items[], total, filters {frameworks, statuses, risks, categories}, summary[] (per framework), disclaimer }`.

Control item: `id, code, frameworkKey, framework, category, name, riskLevel, risk, status, statusLabel, confidence, requiredEvidence[], matchedEvidence[], missingEvidence[], evidenceCount, analysisNote, updatedAt, findingId, findingTitle, priority`.

### `GET /api/controls/:idOrCode`
Accept a control id (`ctl-soc2-cc6-1`) or code (`SOC2-CC6.1`, case-insensitive). Returns:

```json
{
  "control": { "id": "…", "code": "SOC2-CC6.1", "name": "Logical Access Security Measures",
               "frameworkKey": "soc2", "framework": "SOC 2 Trust Services Criteria", "frameworkVersion": "2017 TSC",
               "category": "Access Control", "description": "…", "rationale": "…", "riskLevel": "high",
               "status": "needs_attention", "statusLabel": "Needs attention", "confidence": 0.57,
               "analysisNote": "…", "updatedAt": "…", "isPolicyDomain": false },
  "requirements": [{ "label": "Access control policy", "satisfied": true }],
  "evidenceFound": [ /* evidence items */ ],
  "evidenceMissing": ["Periodic access reviews"],
  "analysis": { "mode": "Demo Analysis Mode (…)", "note": "…", "mappedDocuments": 4, "confidence": 0.57 },
  "finding": { /* finding or null */ },
  "recommendation": { "fix": "…", "owner": "Security / IT", "timelineDays": 30 },
  "relatedControls": [{ "id", "code", "name", "status", "statusLabel" }],
  "disclaimer": "…"
}
```

### `GET /api/mappings`
The Evidence → Controls → Findings view: `documents[]` (with their mapped controls), `controls[]` (with confidence, evidence count and missing items), `findings[]` (id, control, title, risk, priority), `summary` and `disclaimer`.

---

## Gap analysis routes *(session)*

### `GET /api/gaps`
Query: `framework`, `risk`, `status` (control status), `category`, `priority`, `owner`, `search`, `sort` (`severity` default, `control`, `owner`, `timeline`, `category`).
Returns `{ items[], total, ratings {critical, high, medium, low, total}, summary {byRisk[], byFramework[], firstWave, categories[], owners[]}, filters {…}, guidanceNotice }`.

Finding shape: `id, controlId, controlCode, controlName, frameworkKey, category, riskLevel, priority, status, title, finding, evidenceFound[{evidenceId, fileName}], evidenceMissing[], recommendation {fix, owner, timelineDays, timelineLabel, priorityNote}, aiGenerated, detectedAt, controlStatus`.

### `GET /api/findings/:id`
Accepts a finding id (`find-soc2-cc7-2`), control id or control code → `{ finding, guidanceNotice }`.

---

## Frameworks and reports *(session)*

### `GET /api/readiness?framework=…`
Returns `{ items[], workspace, disclaimer }`. Each item: `key, name, shortName, version, description, intent, readinessLabel, status ('ready-for-demo' | 'awaiting-evidence'), readinessIndex, bandLabel, counts, components [{key, label, weight, value, weighted, description}], methodology, controls, categories[] (with per-status counts), coverage {documents, documentsMapped, distinctControlsCovered, unmappedDocuments[]}, findings`.

### `GET /api/reports?framework=…`
`{ items[], total, frameworks[], notice }`; each framework option includes its live `controlCount` from the control library. Item: `id, name, frameworkKey, framework, companyName, fileName, generatedAt, status, scoreIndex, requestedBy, downloadUrl`. The demo workspace is auto-seeded with one SOC 2 snapshot so the page is never empty.

### `POST /api/reports`
Body `{ frameworkKey?, workspaceId? }` (`soc2` default) → `201 { report (with summary), message }`. Generation is synchronous and based on the current evidence.

### `GET /api/reports/:id`
`{ report }` including the full `summary`: executive summary, readiness (index, band, components, counts, methodology), `controlsByStatus` (per-status control rows with code, name, category, risk, confidence and a one-line reason — the same lists printed in PDF sections 4–7), critical and high-risk findings, recommendations, evidence inventory, category breakdown, analysis mode and disclaimer.

### `GET /api/reports/:id/pdf`
Streams the PDF (`Content-Type: application/pdf`, `Content-Disposition: attachment; filename="…"`).

The document contains a cover page (COMPLYLENS AI · Compliance Readiness Assessment · company · framework · assessment date · readiness score · analysis mode) followed by twelve numbered sections:

| # | Section |
| --- | --- |
| 1 | Executive Summary |
| 2 | Overall Readiness Score (index, band, weighted components, methodology) |
| 3 | Control Summary (status tiles + per-category breakdown table) |
| 4 | Passed Controls |
| 5 | Partially Covered Controls |
| 6 | Missing Controls |
| 7 | Controls Awaiting Manual Review |
| 8 | Critical Findings |
| 9 | High-Risk Findings |
| 10 | Remediation Recommendations (fix, owner, timeline, priority) |
| 11 | Evidence Inventory |
| 12 | Final Readiness Summary + disclaimer panel |

Every page footer repeats `ComplyLens AI · preliminary readiness assessment · not a certification, audit opinion or legal advice · Demo Data workspace` and the report disclaimer is reproduced verbatim in section 12: *"This report is an AI-generated preliminary readiness assessment. It is not a certification, audit opinion, or substitute for professional compliance advice."*

### `DELETE /api/reports/:id`
Returns `200 { ok: true, deletedId }`.

---

## Example session

```bash
# 1. get a demo session
TOKEN=$(curl -s -X POST localhost:4000/api/auth/demo | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# 2. read the dashboard
curl -s -H "Authorization: Bearer $TOKEN" localhost:4000/api/dashboard | head -c 400

# 3. inspect the worked example control
curl -s -H "Authorization: Bearer $TOKEN" localhost:4000/api/controls/SOC2-CC6.1

# 4. upload evidence (any of pdf, docx, txt, csv)
curl -s -H "Authorization: Bearer $TOKEN" -F file=@policy.txt -F category="Access Control" \
  localhost:4000/api/evidence

# 5. generate and download a report
REPORT=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"frameworkKey":"soc2"}' localhost:4000/api/reports | node -pe 'JSON.parse(require("fs").readFileSync(0)).report.id')
curl -s -H "Authorization: Bearer $TOKEN" -o readiness.pdf "localhost:4000/api/reports/$REPORT/pdf"
```
