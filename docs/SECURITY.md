# Security and product limitations

**Current scope:** this document describes the current ComplyLens implementation and the production configuration reviewed on 22 November 2026. It is not a security certification or independent audit.

## Implemented application controls

| Area | Current implementation |
| --- | --- |
| Password storage | Node.js scrypt password hashing with per-user salt |
| Sessions | Signed HS256 tokens with server-enforced expiry |
| Production authentication | Vercel Production environment has `AUTH_REQUIRED=true` and `DEMO_MODE=false` |
| Organisation isolation | Authenticated routes and store queries apply organisation scoping |
| Evidence attribution | New evidence uploads persist `createdByUser`; signup-imported sample evidence is attributed to the account owner |
| Input handling | Server-side request validation, upload extension allowlist and upload-size limits |
| Error handling | Structured client errors; internal details are logged server-side |
| Database | Supabase PostgreSQL; the core tables in the initial migration have RLS enabled and no public policies are created by that migration |
| Secret handling | Supabase and AI keys are read by the server and must not be exposed in the client bundle |
| PDF processing | Local Poppler/Tesseract processing in a temporary directory; temporary files are removed after processing |

The Supabase server uses a server-only secret key. That key has elevated database privileges, so row-level security is defence in depth rather than the sole tenant boundary. Application-level organisation checks in routes and store queries remain security-critical and should be independently reviewed before handling sensitive customer evidence.

## Known security and enterprise gaps

| Gap | Current status / buyer consideration |
| --- | --- |
| MFA enforcement | Not implemented; a stored preference is not equivalent to enforced MFA |
| SSO / SAML / OIDC | Not implemented |
| Independent penetration test | Not performed |
| Formal security audit / SOC 2 attestation | Not performed |
| Immutable audit trail and export | Not implemented as an append-only, independently verifiable audit log |
| Automated retention deletion | Retention preference exists in product data; scheduled purge enforcement is not implemented |
| Malware scanning | Upload type and size checks exist; no dedicated antivirus/content-disarm pipeline |
| Distributed rate limiting | Current rate limiting is process-local; a shared limiter is needed for horizontally scaled deployments |
| DPA / subprocessor review / data residency | Requires buyer legal and vendor review |
| Incident response and security contact | Buyer should establish a named security contact and incident process |

## AI and evidence privacy

The control matching, statuses and readiness scoring are deterministic application logic. The optional external AI provider can generate evidence summaries and report narrative. When external AI is enabled, relevant extracted evidence text is transmitted to the configured provider. A buyer must review provider terms, data-processing settings and customer permissions before using confidential production evidence.

PDF OCR is performed locally by Poppler and Tesseract in the application runtime. OCR output is advisory and should be checked against the original document.

## Data handling

The application stores extracted evidence text and associated metadata in the configured database. It does not make the original upload a public download. A buyer should review the live database, confirm record ownership, remove seller/test data that is not part of the agreed transfer, and establish a retention/deletion policy before onboarding customers.

## Required buyer hardening

1. Complete an independent application and database security review.
2. Review all organisation-scoped routes and privileged database access.
3. Add enforced MFA and enterprise SSO if required by target customers.
4. Implement automated retention, immutable audit export and shared rate limiting.
5. Add malware scanning and a documented incident-response process.
6. Review AI-provider data terms and execute any required DPAs.
7. Rotate every credential after transfer; never reuse the seller's personal API keys.

**Disclaimer:** this document is a product-scope summary, not legal advice, a penetration-test report, or proof of compliance.
