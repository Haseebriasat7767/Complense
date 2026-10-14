# Product Upgrade Plan: Trustworthy Evidence, Remediation, Consultant Workspaces, Production Verification

This plan is the acceptance contract for the upgrade branch. A capability is not considered complete merely because its UI exists; it must be persisted, authorized, tested, and documented.

## 1. Trustworthy evidence analysis

### Requirements
- Preserve extraction provenance per upload: extraction method, confidence, notes, extracted character count, and review state.
- Keep document-level evidence references attached to every control mapping: source document ID/name, matched signal or required-evidence item, and a short quoted excerpt from extracted text.
- Never present a phrase match as proof of compliance. Use labels such as "supporting evidence found" and "human verification required".
- Make confidence explainable: show coverage, signal strength, extraction quality, and the reason for any penalty; do not label this as a calibrated probability.
- Treat scanned PDFs, empty extraction, unusual encodings, corrupted files, and low-quality extraction as review-required. Do not let unverified text close a control.
- Add tests for contradictory text, instruction/template text, case-study text, duplicate signals, and low-confidence extraction.

### Acceptance checks
- Each mapping can be traced to a document and excerpt.
- Low-confidence or failed extraction never silently marks a control passed.
- UI clearly distinguishes extracted text, inferred matches, missing items, and reviewer decisions.
- Tests verify citations point to the correct source and never fabricate a quote.

## 2. Remediation tracking

### Requirements
- Persist a remediation record tied to organization, workspace, finding/control, and creator.
- Fields: title, owner, due date, status (open, in_progress, blocked, ready_for_review, verified, dismissed), priority, required proof, notes, created/updated timestamps.
- Store an append-only event history for assignment, due-date changes, status changes, comments/notes, evidence attachment, verification and dismissal.
- Only authorized users in the same organization may read or change a record; verification must be explicit and attributed to a user.
- Evidence updates must not silently mark a remediation verified. Reassessment and verification are separate actions.
- Add overdue and due-soon filters, "My remediation" view, and links from each finding.

### Acceptance checks
- Create/edit/reassign/status transition survives restart in production persistence.
- Cross-organization IDs return 404/403 without disclosing data.
- Every state change creates an audit event; verified items record who and when.
- Required proof is shown before a remediation can be marked ready for review.

## 3. Consultant / vCISO workflow

### Requirements
- Model a consultant account separately from client organizations; consultants can be explicitly invited to a client workspace with a scoped role.
- Add client portfolio list with per-client readiness, critical gaps, overdue remediations, and last assessment date.
- Support reusable remediation playbooks/templates that can be copied into a client workspace; copied tasks become independent records.
- Client membership is opt-in and revocable; never grant access to all client data from a consultant's general account.
- Add audit events for invitations, membership changes, template use and client switching.
- Provide a demo tenant/client only with visibly fictional data.

### Acceptance checks
- Consultant sees only explicitly assigned clients.
- Removing membership immediately revokes access.
- Reused templates do not share mutable task state between clients.
- Portfolio metrics are derived from each authorized client's scoped records.

## 4. Production verification

### Required automated coverage
- Store contract tests for memory and Supabase implementations.
- Persistence restart test for organizations, workspaces, evidence, remediations, audit events and reports.
- Tenant-isolation matrix across evidence, findings, remediations, reports, billing and workspace routes.
- Role/permission tests for owner, admin, member, consultant and read-only access.
- Billing tests for configured/unconfigured Stripe, valid/invalid webhook signatures, duplicate webhook events, checkout session creation and subscription-state changes.
- Report tests for correct workspace/framework snapshot, valid PDF response, error handling, and unauthorized download.
- Deployment smoke tests against the Vercel function and production health endpoint; do not claim success until run against the actual deployment.
- Verify schema migrations are applied before enabling new routes.

### Release gate
Do not advertise a feature as production-ready until typecheck, unit tests, integration tests, build, deployment smoke tests, and a manual end-to-end pass all succeed. Keep a list of tests not run and external setup still required.

## Implementation order

1. Evidence provenance, review gating, and confidence explanations.
2. Persisted remediation records and audit history.
3. Consultant memberships, client portfolio and reusable playbooks.
4. End-to-end security, persistence, billing and deployment verification.

## Known prerequisites / risks

- Supabase production schema is not automatically updated by adding TypeScript types; migrations must be applied and verified.
- Supabase service credentials must remain server-side. Authorization checks must exist in the application even with RLS enabled.
- OCR requires a real OCR dependency/service and should not be simulated. If no OCR provider is configured, retain the needs-review path.
- Stripe configuration and successful test-mode checkout/webhook processing must be verified before describing billing as operational.
- Never use real customer evidence in the fictional demo workspace or expose one client workspace to another.
