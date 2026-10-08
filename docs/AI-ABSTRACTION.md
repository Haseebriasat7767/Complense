# AI abstraction layer

ComplyLens AI is designed so that **the product works completely without AI**. The assessment — control statuses, evidence-to-control mappings, findings, risk levels, priorities, remediation guidance and the readiness index — is produced by a deterministic rule engine. An AI provider is optional and may only improve *wording*.

```
                 ┌───────────────────────────────────────────────┐
   routes ──────▶│  ai/index.ts                                  │
                 │  analyzeEvidence() · writeNarrative()          │
                 └───────────────┬───────────────┬───────────────┘
                                 │               │
              AI configured & allowed?      always available
                                 │               │
                    ┌────────────▼───┐   ┌───────▼─────────────┐
                    │ providers/     │   │ providers/demo.ts   │
                    │ openai-        │   │ deterministic       │
                    │ compatible.ts  │   │ narrative + summary │
                    └────────┬───────┘   └─────────────────────┘
                             │ any error / timeout / no key
                             └──────────▶ falls back to demo provider
```

## Contract

```ts
type AnalysisMode = 'demo-analysis' | 'external-ai';

analyzeEvidence(request: { fileName, category, content }): Promise<{
  mode, provider, summary, keywords
}>;

writeNarrative(request: {
  companyName, frameworkName, readiness, findings, evidenceCount, analysisModeLabel
}): Promise<{
  mode, provider, executiveSummary, themes
}>;
```

Both entry points are implemented in `server/src/ai/index.ts`. Nothing else in the codebase knows which provider is active — routes and the report renderer only consume the returned strings and the mode label.

## The deterministic provider (default)

`server/src/ai/providers/demo.ts`:

- **`demoSummary`** — takes the first meaningful lines of the extracted text (title, owner, version), detects the matched control keywords for the category, and writes a factual one-to-three sentence summary: `"Access Control: policy document naming owner 'Security Lead' and version 3.2; matches 6 control keywords (access control policy, least privilege, …)."`
- **`demoNarrative`** — builds the executive summary arithmetically from the readiness snapshot: index and band, reviewed/passed/needs-attention/missing counts, the missing controls by code, the highest-risk themes, and an explicit closing paragraph stating that the assessment is generated guidance and not an audit opinion.

It is pure: the same input always produces the same output, it never touches the network, and it never fails.

## The optional external provider

`server/src/ai/providers/openai-compatible.ts` speaks the OpenAI chat-completions shape, so it works with any compatible endpoint:

```bash
AI_PROVIDER=openai-compatible
AI_API_KEY=sk-…
AI_BASE_URL=https://api.openai.com/v1      # or a gateway / self-hosted endpoint
AI_MODEL=gpt-4o-mini
AI_ALLOW_EXTERNAL=true                     # explicit safety switch
AI_TIMEOUT_MS=20000
```

Rules enforced in code:

1. A request is only attempted when **all three** conditions hold: provider is `openai-compatible`, a key is present, and `AI_ALLOW_EXTERNAL=true`. Any missing piece keeps the deterministic provider active.
2. The fetch has an abort timeout; non-2xx responses, malformed JSON and empty completions all fall through to the deterministic provider.
3. Failures are logged once and never surfaced as user-facing errors — the UI keeps working and simply stays in demo mode for that request.
4. Evidence text is only sent when explicitly allowed. Keep `AI_ALLOW_EXTERNAL=false` (the default) if your evidence must not leave your infrastructure.

## Disclosure in the product

The active mode is always visible, never implied:

- `/api/meta` → `analysis: { mode, label, scoring }`
- `/api/context` → `analysisMode: { key, label }`, shown in the app shell and the dashboard banner
- Evidence, control and report payloads carry the mode label (`analysis.mode`, `summary.analysisMode`)
- The PDF prints "Demo Analysis Mode (deterministic local analysis)" or "AI-assisted analysis (<provider>)" on the summary page, and every report ends with the disclaimer that it is an AI-generated preliminary readiness assessment

## What AI is never allowed to do here

- Decide control statuses, mappings, risk levels, priorities, owners or timelines.
- Change any number in the readiness index.
- Produce narratives that claim certification, attestation, an audit opinion or legal advice.

## Adding another provider

1. Create `server/src/ai/providers/<name>.ts` exporting `externalSummary`/`externalNarrative` equivalents.
2. Branch on `config.ai.provider` in `server/src/ai/index.ts`.
3. Keep the same guard rails: explicit enable flag, timeout, fallback on every failure path, and no effect on the deterministic assessment.
