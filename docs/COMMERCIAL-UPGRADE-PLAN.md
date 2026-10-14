# ComplyLens AI — Commercial Upgrade Plan

This plan prioritizes features buyers and security/compliance teams can evaluate in a demo. It is not a claim that these features are already implemented.

## Product direction

Position ComplyLens as a lightweight compliance operations workspace for small SaaS teams and fractional vCISOs—not as an automated certification or audit replacement.

## Tier 1 — Fix trust before adding more AI

- **Evidence citations and provenance:** every assessment should show source filename, exact supporting excerpt, extraction method, and a clear distinction between directly observed evidence and inferred/weak signals.
- **Human review queue:** flag scanned/unreadable files, contradictory statements, template/example language, stale evidence, and low-confidence matches. Never label a control compliant solely because a phrase appears.
- **Evidence freshness:** show upload date, review date, expiry/review-by date, owner, and stale-evidence alerts.
- **Auditable changes:** record who changed a finding, status, owner, due date, or verification outcome.

## Tier 2 — Daily workflow features

- **Remediation tracker:** owner, due date, severity, status, required proof, comments, overdue filters, and verification history.
- **Evidence request portal:** invite a client or control owner to upload requested documents against a specific control without giving them access to the entire workspace.
- **Reusable remediation playbooks:** framework-aware task templates with owner suggestions, steps, evidence required, and target dates.
- **Executive reporting:** trend over time, top blockers, overdue actions, evidence freshness, and clear methodology; export PDF/CSV without overstating assurance.

## Tier 3 — Features that can differentiate the product

- **Vendor risk register:** vendor inventory, inherent risk, questionnaire answers, evidence attachments, review dates, owner, and residual-risk decision log.
- **Security questionnaire assistant:** draft answers from approved evidence and prior answers, cite the source for each answer, flag unsupported answers, and require human approval before export. Never fabricate certifications or controls.
- **Customer-facing trust center:** publish only explicitly approved policies, security summaries, and current reports; include owner-controlled publication, version history, and revoke/unpublish controls.
- **Continuous monitoring integrations:** start with read-only checks from GitHub and cloud identity/security providers; store check timestamp, result, source, and failure state. Do not imply continuous monitoring if checks are scheduled or unavailable.
- **Multi-client consultant workspace:** strict tenant isolation, per-client membership, role-based access, portfolio dashboard, reusable playbooks, and a documented offboarding/revocation path.

## Tier 4 — Commercial readiness and safety

- Tenant-isolation and authorization tests across every object endpoint.
- Supabase migrations and verified production persistence.
- Stripe test-mode checkout, webhook signature verification, idempotency, cancellation, and entitlement tests before advertising paid plans.
- Upload limits, safe file handling, retention/deletion controls, backup/restore procedure, and clear incident contact.
- CI checks, smoke tests, error monitoring, and a rollback/release checklist.
- Clear product disclaimer: readiness assistance only, not certification, legal advice, or an independent audit.

## Acceptance gates

A feature is not complete until its API/UI path is wired, authorization is tested, persistence is verified, error states are covered, and the deployed path is smoke-tested. A document or mockup alone does not satisfy this gate.

## Metrics to prove demand

Track activated workspaces, first evidence upload, time to first useful finding, weekly active workspaces, remediation tasks completed, invited collaborators, paid conversion, churn, and customer-reported time saved. Do not claim product-market fit from feature count alone.

## Honest scoring policy

Rate feature quality, commercial readiness, differentiation, and demand separately. Only raise a category score when working behavior and evidence support it. A roadmap cannot justify an 8/10 score by itself.
