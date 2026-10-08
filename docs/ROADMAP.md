# Roadmap

Everything on this page is **documented, not implemented**. This build contains no stubs, feature flags or half-finished screens for these items — the product only ships what works end to end.

Ordering reflects dependency and value: integrations need a connector layer, continuous monitoring needs scheduled assessment runs, and collaboration needs role-aware workflows.

---

## 1. Integrations — collect evidence where it already lives

| Integration | Evidence it could capture automatically |
| --- | --- |
| GitHub / GitLab | Branch protection, required reviews, CODEOWNERS, deployment approvals, Dependabot alerts |
| AWS | IAM policies and access keys, CloudTrail logging status, S3 encryption, security-group exposure |
| Google Workspace / Microsoft 365 | MFA enforcement, admin roles, mailbox forwarding rules, device compliance |
| Slack | Incident channel transcripts and post-incident reviews |
| Jira / Linear | Change tickets with approvals, remediation tickets with due dates |
| Okta / Entra ID | User population, joiner/mover/leaver records for access reviews |

Why it matters: today the user uploads documents. Connectors replace manual collection with a scheduled, repeatable pull, which is what makes evidence "continuous" instead of point-in-time.

Shape: a `connectors/` service that authenticates read-only, maps provider data to the required-evidence items in the control library, and stores a signed snapshot with a retrieval timestamp.

## 2. Automated evidence collection and refresh

Scheduled collection (hourly/daily), diffing against the previous snapshot, and automatic status recalculation when a control's evidence changes. Includes expiry reminders for time-bounded evidence (penetration tests, training, access reviews).

## 3. Continuous monitoring

- Always-current readiness index instead of a snapshot per report
- Drift alerts: "SOC2-CC6.1 moved from passed to needs attention"
- Trend charts per framework, per category, per owner
- Slack/email digest of changed controls

## 4. Scheduled assessments and report automation

- Recurring readiness reports (weekly/monthly) delivered by email
- Report comparison: what improved, what regressed, why
- Immutable report history with the evidence snapshot that produced it

## 5. Team collaboration

- Assignments with due dates per finding, comments and status transitions
- Owner-based views ("my gaps"), workload balancing
- Internal review workflow (prepared → reviewed) before the auditor arrives
- Activity feed and per-control history

## 6. Enterprise access control

- SSO (SAML 2.0 and OIDC), SCIM user provisioning
- Enforced MFA, per-organisation session policies
- Fine-grained roles (Owner / Admin / Auditor / Contributor / Read-only)
- Immutable audit-log export, IP allowlists

## 7. Advanced AI capabilities

- OCR and table extraction for scanned documents and screenshots
- Diffing policies between periods ("what changed in the access-control policy?")
- Drafting remediation documentation and reviewer notes
- Answering "show me everything that evidences CC6.1" across the workspace
- **Guard rail that will not change:** the deterministic engine remains the source of truth for statuses, mappings, scores and priorities. AI may only assist wording, extraction and retrieval.

## 8. Automated remediation tracking

- Two-way sync of findings into Jira/Linear with due dates
- Auto-recheck of a finding when a linked ticket closes or new evidence is uploaded
- SLA tracking per priority (P1 → P4) with escalation

---

## Platform work that must accompany the above

| Area | Work |
| --- | --- |
| Storage | Object storage for evidence with encryption at rest, per-organisation keys, retention jobs |
| Scale | Stateless API instances, shared rate limiting, background job queue for analysis and PDF rendering |
| Data model | Formal migrations, immutable report snapshots, evidence versioning |
| Quality | End-to-end browser tests, load tests, accessibility audit, penetration test |
| Compliance of the product itself | SOC 2 readiness for ComplyLens (using ComplyLens), DPA and sub-processor list — the product must not claim certifications it does not hold |

## Explicitly out of scope

- Acting as a certification body, issuing audit opinions, or replacing an auditor
- Licensed reproduction of the SOC 2 Trust Services Criteria or ISO/IEC 27001 standard text — the control library is an original, curated summary for readiness purposes
- Storing production customer evidence in this demo deployment
