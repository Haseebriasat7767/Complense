import { useState } from 'react';
import { BookOpen, Boxes, Database, KeyRound, Layers, Rocket, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { DemoButton, Eyebrow, Section } from '@/components/marketing/MarketingLayout';

/**
 * In-app documentation. The same content ships as Markdown in /docs so a buyer
 * can read it without running the app.
 */
const DOCS = [
  { id: 'architecture', label: 'Architecture', icon: Boxes },
  { id: 'api', label: 'API overview', icon: Layers },
  { id: 'data-model', label: 'Data model', icon: Database },
  { id: 'analysis', label: 'Analysis engine', icon: BookOpen },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'deployment', label: 'Deployment', icon: Rocket },
  { id: 'roadmap', label: 'Roadmap', icon: KeyRound },
] as const;

export function DocumentationPage() {
  const [active, setActive] = useState<string>('architecture');

  return (
    <>
      <Section className="border-b border-ink-200 pb-10">
        <div className="max-w-3xl">
          <Eyebrow>Documentation</Eyebrow>
          <h1 className="mt-3 text-3xl tracking-tight sm:text-4xl">Build, run and deploy ComplyLens</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-500">
            A single Node/TypeScript process serves the API and the React application. Everything works with no
            configuration; optional MongoDB and AI provider settings are additive.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="neutral">Node 20+</Badge>
            <Badge tone="neutral">React + TypeScript + Vite</Badge>
            <Badge tone="neutral">Express</Badge>
            <Badge tone="neutral">MongoDB (optional)</Badge>
            <Badge tone="neutral">PDFKit</Badge>
            <Badge tone="brand">Zero paid APIs required</Badge>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <nav aria-label="Documentation sections" className="h-fit lg:sticky lg:top-20">
            <ul className="space-y-0.5">
              {DOCS.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => setActive(doc.id)}
                    aria-current={active === doc.id ? 'true' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                      active === doc.id ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                    }`}
                  >
                    <doc.icon className="size-4 shrink-0" aria-hidden="true" />
                    {doc.label}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-5 rounded-lg border border-ink-200 bg-ink-50 px-3 py-3 text-[12px] leading-relaxed text-ink-500">
              The Markdown versions live in <code className="font-mono">/docs</code> in the repository.
            </p>
          </nav>

          <div className="min-w-0">
            <Tabs
              items={DOCS.map((doc) => ({ id: doc.id, label: doc.label }))}
              active={active}
              onChange={setActive}
              className="lg:hidden"
              size="sm"
              ariaLabel="Documentation sections"
            />

            <div className="mt-6 lg:mt-0">
              <TabPanel id="architecture" active={active}>
                <Doc title="Architecture">
                  <P>
                    ComplyLens is a two-workspace repository that produces one deployable. The Express server owns the
                    API, the deterministic analysis engine, PDF generation and — in production — the built client. In
                    development the Vite dev server is mounted as Express middleware, so the API and the app share one
                    origin and one port.
                  </P>
                  <Code>{`client/   React 19 + TypeScript + Vite + Tailwind v4 + Recharts + Lucide
server/   Express (TypeScript, ESM) — API, analysis engine, PDF, store
  ├─ domain/     frameworks, control library, evidence corpus, scoring, findings
  ├─ services/   readiness snapshots + text extraction
  ├─ pdf/        readiness report renderer (PDFKit)
  ├─ ai/         provider abstraction (deterministic default)
  ├─ store/      memory + MongoDB behind one interface
  └─ routes/     /api surface
/docs/    architecture, API, data model, analysis, deployment, security, roadmap`}</Code>
                  <P>
                    The analysis engine is pure: it takes a control library and a set of evidence records and returns
                    assessments, mappings, findings and a readiness index. That means the dashboard, control pages, gap
                    analysis and reports all read from the same computation — they cannot disagree.
                  </P>
                </Doc>
              </TabPanel>

              <TabPanel id="api" active={active}>
                <Doc title="API overview">
                  <P>
                    All endpoints are JSON under <CodeInline>/api</CodeInline>. Authenticated routes expect{' '}
                    <CodeInline>Authorization: Bearer &lt;session token&gt;</CodeInline>; the report PDF endpoint also
                    accepts <CodeInline>?access_token=</CodeInline> so it can be opened directly.
                  </P>
                  <Table
                    rows={[
                      ['GET', '/api/health', 'Runtime, store and analysis mode'],
                      ['GET', '/api/meta', 'Frameworks, categories, scoring weights, limits, disclaimers'],
                      ['POST', '/api/auth/demo | login | signup | logout | forgot-password', 'Session lifecycle'],
                      ['GET', '/api/context', 'User, organisation, workspace, workspaces'],
                      ['GET', '/api/dashboard', 'Aggregate metrics, priority findings, recent evidence, activity'],
                      ['GET/POST', '/api/evidence', 'List (filter by status, framework, category, search) and upload'],
                      ['GET/PATCH/DELETE', '/api/evidence/:id', 'Inspect, update or delete a document'],
                      ['POST', '/api/evidence/:id/analyze', 'Re-run the analysis pipeline for one document'],
                      ['GET', '/api/controls', 'Control library with assessment, filters and sorting'],
                      ['GET', '/api/controls/:idOrCode', 'Control detail, requirements, evidence, recommendation'],
                      ['GET', '/api/mappings', 'Evidence → controls → findings relationship'],
                      ['GET', '/api/gaps', 'Findings with filters, ratings and remediation guidance'],
                      ['GET/POST', '/api/reports', 'List snapshots, generate a new one'],
                      ['GET', '/api/reports/:id/pdf', 'Stream the PDF readiness report'],
                      ['GET', '/api/readiness', 'Per-framework readiness, categories and coverage'],
                    ]}
                  />
                </Doc>
              </TabPanel>

              <TabPanel id="data-model" active={active}>
                <Doc title="Data model">
                  <P>
                    Only user-mutable records are persisted. Assessments, mappings, findings and the readiness index are
                    derived deterministically from evidence, which is why an in-memory store is enough for the demo.
                  </P>
                  <Code>{`Organization  id, name, plan, primaryFramework, settings
Workspace     id, organizationId, name, isDemo
User          id, organizationId, email, role, passwordHash(scrypt)
Evidence      id, organizationId, workspaceId, fileName, category,
              status(analyzed|analyzing|needs_review|failed),
              frameworkKeys, content(extracted text), summary
Report        id, frameworkKey, generatedAt, scoreIndex, summary(snapshot)
AuditEvent    id, organizationId, actor, action, target, at

Derived at request time
  ControlAssessment  status, confidence, matched/missing evidence items
  MappingEntry       evidence → control with per-control confidence
  Finding            risk, priority, recommendation(owner, timeline, fix)
  ReadinessScore     weighted index + component breakdown`}</Code>
                  <P>
                    Add MongoDB by setting <CodeInline>MONGODB_URI</CodeInline>. The same interface backs both stores
                    (<CodeInline>server/src/store/store.ts</CodeInline>), so swapping in Postgres later is a
                    single-file change.
                  </P>
                </Doc>
              </TabPanel>

              <TabPanel id="analysis" active={active}>
                <Doc title="Analysis engine">
                  <P>
                    Evidence text is normalised, then matched against the evidence items each control expects. Every
                    item declares literal signal phrases — for example <CodeInline>least privilege</CodeInline> or{' '}
                    <CodeInline>quarterly access review</CodeInline> — so the same evidence always produces the same
                    result.
                  </P>
                  <Code>{`coverage = matched items / required items
  coverage >= 0.75            → passed
  coverage >= 0.30            → needs_attention  (partial evidence)
  weak mention only           → needs_review
  neither                     → missing

confidence = 0.65 × coverage + 0.35 × signal strength

Readiness index (weighted, published in the UI)
  control health        28%   status credit (partial = 0.7)
  evidence coverage     35%   reviewed controls with ≥1 mapped document
  evidence depth        12%   required items satisfied per evidenced control
  remediation planning  25%   findings with a fix, owner and timeline`}</Code>
                  <P>
                    Documents marked <CodeInline>needs_review</CodeInline> never satisfy a required item — unverified
                    extraction should not close a control. This is the rule that keeps the demo honest and the
                    behaviour defensible in a real audit conversation.
                  </P>
                </Doc>
              </TabPanel>

              <TabPanel id="security" active={active}>
                <Doc title="Security">
                  <P>
                    Implemented in this build: scrypt password hashing, HS256 session tokens with expiry, protected
                    routes, organisation-scoped queries, server-side validation of every request body, upload type and
                    size enforcement, in-memory file parsing, security headers, per-IP rate limiting on authentication
                    and a 600 request/minute ceiling on the API.
                  </P>
                  <P>
                    Secrets come from environment variables only. No provider key, database credential or signing secret
                    is compiled into the client bundle, and evidence text is never sent to a third-party provider unless
                    an operator sets both <CodeInline>AI_API_KEY</CodeInline> and{' '}
                    <CodeInline>AI_ALLOW_EXTERNAL=true</CodeInline>.
                  </P>
                  <P>
                    Not implemented (and not claimed): SSO, MFA enforcement, encryption at rest, field-level encryption,
                    bring-your-own-key, audit immutability, or a SOC 2 / ISO 27001 certification.
                  </P>
                </Doc>
              </TabPanel>

              <TabPanel id="deployment" active={active}>
                <Doc title="Deployment">
                  <Code>{`# local development (single process, single port)
npm install
npm run dev                 # http://localhost:4000

# production build
npm run build               # builds client/dist then server/dist
npm start                   # serves API + built client on :4000`}</Code>
                  <P>
                    <strong>Railway / Render / any Node host:</strong> build command{' '}
                    <CodeInline>npm run build</CodeInline>, start command <CodeInline>npm start</CodeInline>, health
                    check path <CodeInline>/api/health</CodeInline>. Set <CodeInline>SESSION_SECRET</CodeInline> and,
                    if you want persistence, <CodeInline>MONGODB_URI</CodeInline>.
                  </P>
                  <P>
                    <strong>Vercel:</strong> the client deploys as a static build from{' '}
                    <CodeInline>client/</CodeInline> and the API deploys as a Node serverless function or a separate
                    service. Because the client calls the API on the same origin by default, set{' '}
                    <CodeInline>VITE_API_BASE_URL</CodeInline> when the API lives on a different host.
                  </P>
                  <P>
                    No domain purchase is required: the app works on localhost and on any platform-provided preview URL.
                  </P>
                </Doc>
              </TabPanel>

              <TabPanel id="roadmap" active={active}>
                <Doc title="Roadmap">
                  <P>
                    Deliberately not implemented in this MVP — listed so a buyer knows exactly what they are getting:
                  </P>
                  <ul className="space-y-2">
                    {[
                      'GitHub, AWS, Google Workspace, Microsoft 365, Slack and Jira integrations',
                      'Automated evidence collection and continuous monitoring',
                      'Scheduled assessments and drift alerts',
                      'Team collaboration: assignments, comments, approvals',
                      'SSO (SAML/OIDC) and granular role-based permissions',
                      'Advanced AI analysis with retrieval over evidence text',
                      'Automated remediation tracking with verification evidence',
                      'Licensed control libraries and custom framework import',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[13.5px] text-ink-600">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-300" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Doc>
              </TabPanel>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 px-4 py-4">
              <p className="flex-1 text-[13px] text-ink-600">
                Prefer to click through it instead of reading it? The demo workspace is one click away.
              </p>
              <DemoButton label="Try the Demo" />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

function Doc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-ink-900">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </article>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] leading-relaxed text-ink-600">{children}</p>;
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto scroll-area rounded-lg border border-ink-200 bg-ink-900 px-4 py-3.5 font-mono text-[11.5px] leading-relaxed text-ink-100">
      {children}
    </pre>
  );
}

function CodeInline({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-ink-200 bg-ink-100 px-1.5 py-0.5 font-mono text-[12px] text-ink-700">
      {children}
    </code>
  );
}

function Table({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <div className="overflow-x-auto scroll-area">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead>
          <tr className="border-b border-ink-200">
            <th scope="col" className="py-2 pr-3 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
              Method
            </th>
            <th scope="col" className="py-2 pr-3 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
              Path
            </th>
            <th scope="col" className="py-2 text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
              Purpose
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([method, path, purpose]) => (
            <tr key={path} className="border-b border-ink-100 last:border-0">
              <td className="py-2 pr-3 font-mono text-[11.5px] whitespace-nowrap text-brand-700">{method}</td>
              <td className="py-2 pr-3 font-mono text-[11.5px] text-ink-800">{path}</td>
              <td className="py-2 text-[12.5px] text-ink-500">{purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
