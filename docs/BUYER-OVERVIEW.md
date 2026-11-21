# ComplyLens AI — Buyer Overview

**Asset:** pre-revenue compliance-readiness software  
**Live product:** https://complense.vercel.app  
**Source:** https://github.com/Haseebriasat7767/Complense  
**Seller's stated operating metrics:** 0 paying customers; $0 MRR.

## Product

ComplyLens is a web application for preliminary SOC 2 and ISO/IEC 27001 readiness work. A user uploads evidence, the application extracts text, maps it against a curated control library, highlights potential gaps and suggested remediation, and generates a PDF readiness report.

## Included capabilities

- Authenticated user and organisation workflows.
- Evidence upload for PDF, DOCX, TXT and CSV.
- PDF text extraction with local OCR fallback.
- Curated SOC 2 and ISO 27001 control mapping.
- Deterministic readiness scoring and risk/gap summaries.
- Suggested remediation actions.
- PDF readiness report generation.
- Supabase PostgreSQL persistence in production.
- Optional Gemini-generated summaries and report narrative, with deterministic fallback.

## Technology and infrastructure

React + TypeScript frontend; Node.js + Express + TypeScript API; Vercel hosting; Supabase PostgreSQL; Gemini-compatible AI provider adapter; Stripe integration code.

The live deployment is configured for authenticated access with demo mode disabled. The seller confirmed that an evidence analysis completed after the latest production deployment. Buyer acceptance testing is still required.

## Commercial status

- No paying customers.
- $0 MRR.
- No verified revenue history or customer contracts are represented.
- Stripe code is present, but the reviewed production Vercel environment did not contain the Stripe secret, webhook secret and plan-price configuration required for live checkout.
- No valuation or future revenue is guaranteed.

## Best-fit strategic buyers

- SOC 2 and ISO 27001 consulting practices.
- vCISO and managed security service providers.
- GRC and cybersecurity software vendors.
- Compliance implementation agencies.

A strategic buyer could adapt the application as an internal evidence-readiness tool, a client delivery accelerator, or a starting point for a broader GRC offering.

## Material limitations to review

- Curated control coverage; not a full licensed reproduction of the standards.
- Readiness support only; no certification or audit opinion.
- MFA enforcement and enterprise SSO are not implemented.
- No independent penetration test or formal security certification.
- Automated retention enforcement and immutable audit export are not implemented.
- Third-party integrations and continuous evidence collection are not implemented.
- Stripe checkout needs buyer-owned production configuration and acceptance testing.

## Transaction scope

The intended transaction is an outright sale of the agreed software/IP assets. The exact transfer scope must be stated in a signed agreement. Buyer should receive repository/source, agreed documentation and the right to operate/modify the transferred code, subject to seller's authority to assign it and third-party licence terms.

The repository currently declares `UNLICENSED`; it is public, but that does not grant reuse rights. Complete an IP assignment and dependency-licence review as part of closing. Vercel, Supabase, Gemini and Stripe accounts, domains, API keys and other personal/provider accounts require separate transfer or buyer-owned replacement; they are not automatically included.

