# Current deployment and buyer handover

This document supersedes the older deployment notes that described the original in-memory/MongoDB demo baseline.

## Current production

- Application: https://complense.vercel.app
- Hosting: Vercel
- Database: Supabase PostgreSQL using the server-side Data API
- Latest production commit reviewed: `980a9e621c1009ecfff0387dc67a0a952d177219`
- Production authentication configuration: `AUTH_REQUIRED=true`, `DEMO_MODE=false`
- AI provider: Gemini-compatible adapter; production AI environment variables are present, but the buyer must run a fresh acceptance test with non-sensitive sample evidence.
- Stripe: integration code exists, but production Stripe environment variables/prices were not present in the reviewed Vercel environment. Configure and test before advertising paid subscriptions.

## New deployment prerequisites

- Node.js 22.12+
- GitHub repository access
- Vercel project and production environment
- Supabase project with all migrations applied in order: `20261009000100_initial_schema.sql`, `20261014000100_stripe_billing.sql`, `20261108000100_add_remediation_tables.sql`, `20261120132106_private_evidence_storage.sql`
- Server-side secrets: `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
- Optional external AI configuration: `AI_PROVIDER=openai-compatible`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `AI_ALLOW_EXTERNAL=true`
- Optional Stripe configuration: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and all three plan price IDs

Do not copy the seller's personal credentials to a buyer. Create buyer-owned provider accounts or transfer provider projects using the provider's supported ownership-transfer process, then rotate all secrets.

## Build and test

```bash
npm ci
npm run build
npm test
npm run verify:deploy
```

Run these commands in the buyer's controlled environment after the repository and environment variables are transferred. A successful Vercel build alone does not prove database persistence, AI-provider availability, billing or correct tenant isolation.

## Acceptance test

1. Confirm `/api/health` reports a successful Supabase PostgreSQL query.
2. Create a fresh authenticated account.
3. Upload a non-sensitive PDF with a text layer and a scanned PDF; confirm extraction method and review warnings.
4. Confirm evidence is attributed to the signed-in user.
5. Run SOC 2 and ISO 27001 readiness analyses.
6. Generate and download a PDF report; verify all pages and disclaimers.
7. Sign out and back in; confirm data persists.
8. Confirm one organisation cannot read another organisation's evidence, reports or settings.
9. If billing is activated, run Stripe test-mode checkout and webhook lifecycle tests before enabling live mode.

## Asset transfer checklist

- [ ] Signed asset purchase and IP assignment agreement, including precise asset list and exclusions.
- [ ] Buyer receives repository ownership/admin access or a complete source archive and history.
- [ ] Vercel project ownership, deployment settings, domains and environment-variable names transferred.
- [ ] Supabase project ownership, all migrations, database backup, private `evidence-originals` bucket and storage settings transferred.
- [ ] Buyer creates or transfers Gemini/API provider credentials and validates usage/billing.
- [ ] Stripe account and price products configured by the buyer; do not transfer personal financial credentials.
- [ ] All seller-owned secrets rotated and old access revoked after acceptance.
- [ ] Seller/test records reviewed and removed or expressly included by agreement; do not transfer personal or customer data without a lawful basis and explicit scope.
- [ ] Dependency licences, fonts, icons, sample content and other third-party assets reviewed.
- [ ] Buyer completes the acceptance test and confirms receipt.
- [ ] Payment is cleared before final ownership/admin transfer, consistent with the signed agreement.

Infrastructure accounts, domains, API keys, personal accounts and third-party services are not automatically included merely because source code is transferred. List each included asset in the signed agreement.
