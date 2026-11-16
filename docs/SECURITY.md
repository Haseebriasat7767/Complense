# Security

This document describes the implemented security model and the remaining limitations. It is not a certification or an independent security assessment.

## Production security baseline

### Authentication and sessions

- Passwords are stored using scrypt with a per-user random salt and constant-time verification.
- Session tokens are HS256-signed and expire server-side.
- Production requires a stable `SESSION_SECRET`; the application refuses to use an ephemeral signing secret when authenticated production mode is enabled.
- Production configuration must set `AUTH_REQUIRED=true` and `DEMO_MODE=false`.
- Bearer tokens are sent in the Authorization header; query-string tokens are rejected.
- Failed login and password-reset responses avoid revealing whether an account exists.
- Password reset email delivery is not implemented; the endpoint explicitly discloses that no email was sent.

### Authorization and tenant isolation

- Protected API routes require a valid session.
- Evidence, reports, remediations and related events are queried with organization/workspace constraints.
- Resource ownership is checked before updates and deletes.
- Settings writes are role-restricted.
- Supabase RLS is enabled on all eight application tables.
- The current database design intentionally grants no direct table SELECT access to `anon` or `authenticated`; the server accesses the Data API using a server-only Supabase secret key.
- Since the server secret role bypasses RLS, application-level tenant scoping is mandatory. A database administrator should periodically review the grants, policies and route/store scoping together.

### Production persistence

- Supabase PostgreSQL is the required production store.
- Production startup verifies all required application tables and aborts if credentials or database access are missing.
- Production does not silently fall back to MemoryStore.
- MemoryStore is restricted to local development and automated tests.
- Supabase secret credentials must never be placed in browser code or `VITE_*` variables.

### Input, uploads and errors

- Request bodies and query parameters are validated and size-limited.
- Uploads have server-side extension and size checks; file bytes are processed in memory and are not written to the application filesystem.
- Unsupported formats and oversized requests receive structured errors.
- PDF/DOCX text extraction is heuristic. Image-only/scanned PDFs are not OCR-processed and must not be represented as analyzed evidence.
- API errors use stable response envelopes and do not return stack traces or filesystem paths to clients.

### Browser and transport controls

- Security headers include `X-Content-Type-Options: nosniff`, a restrictive referrer policy, a permissions policy and frame protections.
- CORS is same-origin by default; split deployments require an explicit origin allowlist.
- No browser-side Supabase secret is used.

### Abuse controls

- Authentication and API routes have fixed-window rate limits.
- The limiter is process-local; it is not a shared distributed limiter across multiple instances.

## Evidence and privacy handling

Evidence uploads are parsed in memory and extracted text/metadata are persisted in Supabase PostgreSQL. This application does not add field-level/application-layer encryption for evidence content. Do not upload highly sensitive customer records until the data-processing, retention, access and encryption requirements have been reviewed for the intended customer.

If an external AI provider is configured, evidence-derived content may be sent outside the application infrastructure. External AI calls require an explicit provider, API key and `AI_ALLOW_EXTERNAL=true`; keep external AI disabled unless the customer has approved the provider and its data-processing terms.

Deleting evidence removes the application's stored evidence record. Retention preferences do not currently trigger an automated purge job.

## Known gaps — not yet implemented

| Gap | Impact / required work |
| --- | --- |
| MFA enforcement | Stored preference is not MFA; add TOTP/WebAuthn enrolment and login enforcement |
| SSO / SAML / OIDC | No enterprise identity federation |
| Refresh-token rotation and server-side revocation | A stolen token can remain valid until expiry |
| Field-level evidence encryption and key rotation | Extracted content is not separately encrypted by the application |
| Malware scanning / content disarm | Uploads are validated by type and size, not scanned in an isolated worker |
| OCR | Scanned/image-only PDFs require manual review |
| Immutable audit history/export | Events are stored but not append-only or tamper-evident |
| Distributed rate limiting | Current fixed-window counters are process-local |
| Automated retention/deletion | Retention settings do not trigger scheduled purges |
| Password reset delivery | No email delivery provider is configured |
| Independent penetration test | No third-party security assessment has been completed |
| Legal/privacy readiness | DPA, subprocessors, retention, residency and customer contractual requirements need review |

## Security release checklist

Before processing real customer evidence:

- Verify production environment settings without exposing secret values.
- Confirm production health reports `store.kind=supabase`.
- Confirm every application table has RLS enabled and no unintended public/anonymous grants.
- Test two separate organizations and verify no cross-tenant reads, writes, report downloads or remediation access.
- Test malformed, oversized, encrypted, image-only and text-based PDFs.
- Verify persistence across refresh, logout/login and a new server instance.
- Review Supabase security/performance advisors and runtime error logs.
- Complete a privacy/data-processing review and independent security assessment appropriate to the customer data.

## Responsible disclosure

Add a monitored security contact address and enable GitHub private vulnerability reporting before inviting external security reports.
