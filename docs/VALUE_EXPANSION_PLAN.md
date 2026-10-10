# ComplyLens AI — Value Expansion Plan

## Purpose

This plan prioritises upgrades that can make ComplyLens more valuable to a strategic acquirer or paying customer. It does not promise a particular valuation. Value above $10,000 is more credible when a buyer can verify reliable software, a defensible workflow, customer demand, and recurring revenue.

## Upgrade added in this branch

### Buyer-facing ROI scenario calculator

The Product Overview page now includes an interactive calculator where a prospect can model:
- people involved in compliance preparation;
- monthly hours spent per person;
- estimated loaded hourly cost;
- a user-selected time-reduction scenario; and
- an assumed monthly software budget.

It calculates an illustrative monthly time value and annual net scenario. Every output is explicitly described as hypothetical; no savings claim is presented as measured customer results. The calculator is a sales-discovery aid, not a substitute for customer validation.

## Recommended roadmap — in order

### P0 — Reliability and trust (before real customer evidence)
1. Verify the current production deployment and investigate failed recent Vercel deployments.
2. Run typecheck, full tests, build, and deployment smoke test in CI.
3. Use production-safe persistent storage; confirm isolation between organisations with tests.
4. Enforce MFA for privileged users, add auditable security events, and establish a tested retention/deletion process before claiming enterprise readiness.
5. Publish a clear data-processing and security FAQ with only verified claims.

### P1 — Evidence quality and explainability
1. Store the source excerpt and page/section reference for every proposed evidence-to-control match.
2. Distinguish a policy statement, a design description, and evidence that a control operated over time.
3. Make weak, conflicting, stale, or template-only evidence require human review.
4. Add a reviewer decision for each mapping: accepted, rejected, needs more evidence, or not applicable.
5. Record why a control status changed and which evidence contributed to it.
6. Build a benchmark set of permissioned or public sample documents; measure false positives and false negatives and publish the methodology.

### P2 — Paid workflow for consultants
1. Support client workspaces with clear tenant boundaries.
2. Add reusable assessment templates and reviewer notes.
3. Support report branding and a clean client-ready export.
4. Add a repeatable assessment checklist and report history.
5. Interview 10–15 consultants and recruit 3–5 design partners before building integrations speculatively.

### P3 — Commercial proof
1. Offer a clearly scoped paid pilot with agreed success criteria.
2. Track activation, time-to-first-report, reviewer correction rate, repeat usage, and conversion to paid use.
3. Connect a payment provider only after validating the offer and handling billing, refunds, tax, and cancellation flows.
4. Do not claim MRR, ROI, certification readiness, or customer results until measured and documented.

## How to test the ROI calculator

During each demo, ask the prospect to estimate their actual current process. Record their assumptions and compare them with a time study during a pilot. Only use observed results as case-study claims after the customer approves the methodology and wording.

## Commercial positioning

Position ComplyLens as an evidence-triage and readiness workflow for SOC 2 and ISO 27001 preparation. Do not represent it as an auditor, a certification product, or proof that a control is effective.

## What would support a $10,000+ asset sale?

A $10,000+ sale becomes more credible when the buyer can verify:
- reliable production deployment and reproducible builds;
- clean ownership and transferable rights to the code and assets;
- a tested, understandable analysis engine;
- secure tenant boundaries and a credible data-handling posture;
- a useful workflow differentiated by evidence traceability and review;
- documented onboarding and handover; and preferably
- paid pilots, repeat usage, references, or measurable time saved.

These are value drivers, not a guarantee of a $10,000 price.
