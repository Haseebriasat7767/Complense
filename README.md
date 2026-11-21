# ComplyLens AI

**Compliance-readiness software for SOC 2 and ISO/IEC 27001 evidence review.**

Production application: https://complense.vercel.app  
Source repository: https://github.com/Haseebriasat7767/Complense

ComplyLens helps a team organise uploaded evidence, map extracted content to a curated set of SOC 2 and ISO 27001 controls, identify potential gaps, and produce a preliminary readiness report.

> **Important:** ComplyLens is a readiness-support tool. It is not a SOC 2 auditor, certification body, legal adviser, or substitute for an independent audit. Its reports do not establish compliance or certification.

## What the product does

1. **Accept evidence files** — PDF, DOCX, TXT and CSV.
2. **Extract text** — PDF text-layer extraction with local OCR fallback; DOCX body extraction; direct text/CSV reading.
3. **Map evidence** — deterministic rules associate extracted evidence with the product's curated SOC 2 and ISO 27001 control library.
4. **Identify gaps** — show missing or partially supported controls, risk themes and suggested remediation actions.
5. **Generate reports** — create a downloadable PDF readiness report with findings, evidence inventory and limitations.

The deterministic rules own control matching, statuses and readiness scoring. The optional external AI provider can improve evidence summaries and report narrative; it does not decide whether a control is satisfied. If the provider is unavailable, the app falls back to deterministic wording.

## Current production snapshot

Last checked: **22 November 2026**.

| Item | Current status |
| --- | --- |
| Production URL | Live on Vercel: https://complense.vercel.app |
| Latest production release | Commit `980a9e621c1009ecfff0387dc67a0a952d177219` |
| Authentication | Production environment is configured to require authenticated sessions; demo mode is disabled |
| Database | Supabase PostgreSQL configured for production; server-side secret only |
| AI | Gemini provider configuration is present in production; verify the active model and a fresh report during buyer acceptance |
| Evidence ownership | New uploads and signup-imported sample evidence now store the creating user's ID |
| Revenue | $0 MRR; no paying customers (seller-provided status) |
| Payments | Stripe integration code exists, but production Stripe credentials/prices are not currently present in the Vercel project environment; do not represent checkout as live until configured and tested |
| Independent security audit | Not performed |

The seller confirmed a successful evidence analysis after the latest production deployment. Production now fails startup rather than silently switching to temporary in-memory storage if Supabase is unavailable. This is a functional smoke test, not an independent QA or security certification.

## Technology

- **Frontend:** React, TypeScript
- **API:** Node.js, Express, TypeScript
- **Hosting:** Vercel
- **Database:** Supabase PostgreSQL through the server-side Data API
- **AI narrative:** Gemini through an OpenAI-compatible provider adapter, with deterministic fallback
- **Reports:** server-generated PDF
- **Payments:** Stripe integration code is present; production checkout configuration remains outstanding

## Security and data handling

- Passwords are hashed with Node.js scrypt.
- Authenticated API requests use signed, expiring session tokens.
- Server routes and store queries apply organisation scoping.
- Supabase tables in the public schema have row-level security enabled; the application accesses them through a server-only secret key. The browser must never receive this key.
- Uploaded files are processed in memory or a temporary directory; the application stores extracted text and evidence metadata rather than serving the original upload as a public file.
- External AI processing can transmit evidence text to the configured provider. Review the provider's terms and customer-data permissions before using real customer evidence.

These controls are implementation details, not proof of a security certification. No independent penetration test has been completed.

## Known limitations and buyer diligence

- Pre-revenue product: $0 MRR and no paying customers.
- The control library is curated and is not a complete or licensed reproduction of the SOC 2 criteria or ISO/IEC 27001 standard.
- No SOC 2 / ISO certification, audit opinion, legal opinion or guarantee of compliance is provided.
- MFA enforcement and enterprise SSO are not implemented.
- No independent penetration test or formal security audit has been completed.
- Automated evidence-retention deletion and immutable audit-log export are not implemented.
- Third-party integrations and continuous evidence collection are not implemented.
- Stripe checkout is not currently configured in production.
- Vercel imposes a practical request-body limit; the production upload limit should be verified in the live UI before a buyer demo.
- The current repository is public, but `package.json` declares `UNLICENSED`. Public visibility is not an open-source licence or permission to reuse the code. Any sale should include a signed IP/asset assignment and a third-party dependency review.

## Local development

Requirements: Node.js 22.12+ and npm.

```bash
npm ci
npm run build
npm test
npm run dev
```

The app requires server-side environment configuration for a persistent deployment. Start from [`.env.example`](.env.example), and never commit real secrets.

### Production environment variables

Configure these in the hosting provider's secret manager; never put secrets in browser-visible `VITE_*` variables.

| Variable | Purpose |
| --- | --- |
| `AUTH_REQUIRED=true` | Require authenticated sessions |
| `DEMO_MODE=false` | Disable demo-mode behaviour |
| `SESSION_SECRET` | Persistent session-signing secret |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server-only Supabase secret key |
| `AI_PROVIDER` | Set to `openai-compatible` for the configured provider adapter |
| `AI_API_KEY` | Server-only Gemini API key |
| `AI_BASE_URL` | Gemini-compatible API base URL |
| `AI_MODEL` | Model identifier |
| `AI_ALLOW_EXTERNAL=true` | Explicitly allow external AI calls |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_BUSINESS` | Required only to activate subscription checkout |

Apply the database schema from `supabase/migrations/20261009000100_initial_schema.sql` to a new Supabase project before deploying a transferred copy. Verify the schema, RLS, server-only key, health endpoint and a complete signup → upload → analysis → PDF-report flow.

## Documentation

- [Buyer overview](docs/BUYER-OVERVIEW.md)
- [Security and limitations](docs/SECURITY.md)
- [Deployment and environment setup](docs/DEPLOYMENT.md)
- [Database schema migration](supabase/migrations/20261009000100_initial_schema.sql)

Some older documents in `docs/` describe the original in-memory/MongoDB demo baseline. They are historical engineering notes and should not be used as the current production deployment specification.

## Sale and transfer

ComplyLens is offered as a pre-revenue software asset. The intended transaction is an outright sale of agreed intellectual property and assets, subject to written agreement, buyer due diligence and payment clearance. Infrastructure accounts, API keys, personal accounts and any third-party licences must be transferred or recreated lawfully; do not send secrets or database exports before an agreed secure handover.

