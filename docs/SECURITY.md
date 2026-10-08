# Security

This document describes what the demo MVP actually implements, what it deliberately does not, and how to harden it for real use. It is written to be verifiable against the code — nothing here is aspirational.

---

## Implemented controls

### Authentication

| Control | Implementation |
| --- | --- |
| Password storage | `scrypt` with a per-user random salt (`server/src/auth/passwords.ts`); format `scrypt$<salt>$<hash>`; constant-time comparison |
| Session tokens | HS256 JWT signed with `SESSION_SECRET`, `sub`/`email`/`org`/`role`/`demo` claims, server-enforced expiry (`SESSION_TTL_HOURS`, default 12h) |
| Token transport | `Authorization: Bearer <token>`; `?access_token=` is accepted **only** for report/document downloads opened in a new tab |
| Failed login | Single generic message for unknown accounts and wrong passwords: `"Email or password is incorrect."` |
| Demo sessions | Issued by `POST /api/auth/demo` with a real signed token — protected routes behave exactly as for a paying account |
| Sign-out | Client clears the stored session; tokens are short-lived and server-validated on every request |

### Authorisation

- Every session route runs `requireAuth()`, which verifies the token **and** confirms the organisation still exists.
- All store queries are scoped by `organizationId` (`sessionOf(req)`), so a token from one organisation cannot read or mutate another organisation's evidence, controls, findings, reports or settings. `assertSameOrganization()` guards any resource that carries an organisation id.
- Settings writes (`PATCH /api/organization`) additionally require the `owner` or `admin` role; members get `403`.

### Input handling

- Request bodies are validated by helpers in `server/src/http/validate.ts` (required strings with length limits, e-mail and password rules, enums, booleans, clamped integers, size limits for query strings).
- Uploads: extension allowlist (`ALLOWED_UPLOAD_TYPES`) and size limit (`MAX_UPLOAD_MB`, default 10 MB) enforced server-side by multer before the handler runs; unsupported media returns `415`, oversized uploads `400`.
- Uploads are held in memory (`multer.memoryStorage()`) and are **never written to disk**; only the extracted text and metadata are stored.
- JSON bodies are capped at 1 MB.

### Output and error handling

- Errors are returned as a stable envelope: `{ error: { code, message } }`. `errorHandler` logs the internal error server-side and returns a safe message plus an `errorId` for correlation — never a stack trace, SQL/DB error or file path.
- Unknown API routes return a structured `404` rather than falling through to the SPA shell.
- `X-Powered-By` is disabled.

### Transport and browser hardening

Set by `securityHeaders()` on every response:

| Header | Value |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Frame-Options` | `SAMEORIGIN` (production only) |

`CORS_ORIGINS` (empty by default) enables an explicit allowlist for split deployments; no wildcard-with-credentials combination is possible because cookies are never used.

### Abuse protection

- Fixed-window rate limiter on `/api`: 600 requests/minute per IP, with `X-RateLimit-*` and `Retry-After` headers (`server/src/http/security.ts`). Single-instance only — see hardening below.

### Secrets

- All secrets come from environment variables and are read in one place (`server/src/config.ts`). `.env` is loaded from the repo root, is git-ignored, and `.env.example` documents every variable.
- Nothing secret is exposed to the frontend: the client bundle only knows the API base URL (and only if `VITE_API_BASE_URL` is set).
- The app boots without any keys; a missing AI key degrades to the deterministic engine rather than failing.

---

## Deliberately not implemented (honest scope)

| Gap | Impact | Recommended next step |
| --- | --- | --- |
| Real MFA enforcement | `mfaRequired` is a stored preference only | TOTP or WebAuthn enrolment + enforcement on login |
| SSO / SAML / OIDC | Not present | Add an identity provider integration (roadmap) |
| Refresh-token rotation & revocation list | A stolen token is valid until it expires | Short-lived access tokens + refresh tokens, or server-side session store |
| Encrypted-at-rest evidence storage | Demo keeps text in memory / plain Mongo documents | Use a KMS-backed encrypted store, field-level encryption for extracted text |
| Antivirus / content disinfection of uploads | Only extension + size are checked | Scan uploads in a sandboxed worker before analysis |
| Immutable audit log export | Events are recorded but cannot be exported or made append-only | Append-only store with hash chaining and export UI |
| CSRF protection | Not needed today (no cookie auth) | Required if cookies are introduced |
| Distributed rate limiting | Per-process limiter | Redis-backed limiter for multi-instance deployments |
| Data residency / DPA / sub-processor review | Out of scope for a demo | Legal review before handling real customer evidence |
| Penetration testing | Not performed | Independent review before production use |

---

## Threat model summary

| Threat | Mitigation in this build |
| --- | --- |
| Cross-organisation data access | Organisation scoping on every query + `assertSameOrganization` |
| Credential stuffing / brute force | Rate limiting, generic error messages, scrypt hashing |
| Token theft via XSS | No cookies, no `dangerouslySetInnerHTML`, React escaping, evidence text rendered as text |
| Malicious uploads | Extension + size allowlist, in-memory parsing, no shell/file-system execution |
| Prompt injection via evidence text (if AI enabled) | Evidence text is only ever inserted as *content* to summarise; statuses, scores and mappings are never AI-controlled |
| DoS via large payloads | 1 MB JSON cap, 10 MB upload cap, rate limiting, per-process memory store (no unbounded disk writes) |
| Information leakage in errors | Generic client messages, `errorId` correlation, server-side logging only |
| Clickjacking | `X-Frame-Options: SAMEORIGIN` in production |
| Secret leakage in the bundle | Server-only secret handling; `.env` git-ignored |

## Privacy notes

- The demo workspace is synthetic ("AcmeCloud (Demo Data)"). The real persona names are fictional.
- Extracted evidence text lives in the store (memory by default, MongoDB if configured). Deleting a document removes its text from the store.
- `retentionDays` is a stored preference in this build; nothing is purged automatically. A production deployment must implement the retention job.
- If you enable an external AI provider, evidence text may leave your infrastructure. Keep `AI_ALLOW_EXTERNAL=false` (the default) unless that is acceptable, and review the provider's data-processing terms.

## Reporting a vulnerability

This is a demo project without a security contact. If you fork or deploy it publicly, add a `SECURITY.md` contact address, enable GitHub private vulnerability reporting, and run dependency auditing (`npm audit`, Dependabot) on a schedule.
