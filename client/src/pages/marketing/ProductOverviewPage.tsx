import { AlertTriangle, ArrowRight, BadgeCheck, Calculator, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { DemoButton, Eyebrow, Section } from '@/components/marketing/MarketingLayout';

/**
 * Buyer-facing product overview ("Product Asset Overview").
 * Linked from the footer and /docs — every figure here is stated honestly.
 */
const FEATURES = [
  ['Evidence workspace', 'Upload and organise PDF, DOCX, TXT and CSV evidence with category and framework tagging'],
  ['Deterministic analysis', 'Rule-based mapping engine with no external API dependency and reproducible results'],
  ['Evidence-to-control mapping', 'Per-document and per-control mapping view with confidence scoring'],
  ['Control library', '28 SOC 2 criteria and 22 ISO 27001 Annex A controls across 14 categories'],
  ['Gap analysis', 'Risk-rated findings with filtering by framework, risk, status, category, owner and priority'],
  ['Remediation guidance', 'Suggested fix, owner and timeline per finding, clearly labelled as generated guidance'],
  ['Readiness reporting', 'Server-rendered PDF with cover, executive summary, findings, remediation and evidence inventory'],
  ['Auth and tenancy', 'Sign-up, log in, forgot password, demo entry, protected routes, organisation-scoped data'],
  ['Settings', 'Profile, organisation, workspace, framework preferences, security and demo billing pages'],
  ['Documentation', 'README, /docs set and in-app documentation covering architecture to deployment'],
];

const TECH = [
  ['Frontend', 'React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Recharts, Lucide'],
  ['Backend', 'Node.js 20+, Express 4, TypeScript (ESM), Multer, PDFKit'],
  ['Data', 'In-memory demo store by default; MongoDB via Mongoose when MONGODB_URI is set'],
  ['Analysis', 'Deterministic signal-matching engine with an optional OpenAI-compatible narrative layer'],
  ['Security', 'scrypt hashing, HS256 session tokens, rate limiting, security headers, server-side validation'],
  ['Deployment', 'Single Node process, health endpoint, Vercel-ready static client with a separate API service'],
];

const OPPORTUNITIES = [
  'Sell as a source-code asset with a documented architecture and a working demo',
  'Subscription SaaS with the three plans already designed into the product',
  'White-label readiness assessment for audit firms and managed security providers',
  'Evidence automation add-ons (GitHub, AWS, Google Workspace, Microsoft 365, Jira)',
  'Licensed control libraries (SOC 2, ISO 27001, HIPAA, PCI DSS) as a paid module',
  'Continuous monitoring and scheduled re-assessment as an enterprise tier',
];

export function ProductOverviewPage() {
  const [teamSize, setTeamSize] = useState(3);
  const [hoursPerPerson, setHoursPerPerson] = useState(8);
  const [hourlyCost, setHourlyCost] = useState(75);
  const [estimatedReduction, setEstimatedReduction] = useState(25);
  const [monthlyToolCost, setMonthlyToolCost] = useState(149);
  const estimate = useMemo(() => {
    const monthlyHours = teamSize * hoursPerPerson;
    const savedHours = monthlyHours * (estimatedReduction / 100);
    const monthlyValue = savedHours * hourlyCost;
    const netMonthlyValue = monthlyValue - monthlyToolCost;
    return { monthlyHours, savedHours, monthlyValue, netMonthlyValue, annualNetValue: netMonthlyValue * 12 };
  }, [teamSize, hoursPerPerson, hourlyCost, estimatedReduction, monthlyToolCost]);

  return (
    <>
      <Section className="border-b border-ink-200 pb-12">
        <div className="max-w-3xl">
          <Eyebrow>Product overview</Eyebrow>
          <h1 className="mt-3 text-3xl tracking-tight sm:text-4xl">ComplyLens AI — Product Overview</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-500">
            A demo-first SaaS MVP for compliance readiness and gap analysis: upload evidence, map it to SOC 2 and ISO
            27001 controls, prioritise the gaps and generate a professional readiness report.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="neutral">Stage: MVP / demo</Badge>
            <Badge tone="neutral">Users: 0</Badge>
            <Badge tone="neutral">Customers: 0</Badge>
            <Badge tone="neutral">Revenue: $0</Badge>
            <Badge tone="brand">No paid APIs required</Badge>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <DemoButton label="Open the demo workspace" />
            <ButtonLink to="/documentation" variant="secondary" iconRight={<ArrowRight className="size-4" />}>
              Read the documentation
            </ButtonLink>
          </div>
        </div>
      </Section>

      <Section className="border-b border-ink-200">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="surface p-5">
            <h2 className="text-[15px] font-semibold text-ink-900">Problem</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">
              Small and mid-sized B2B companies are asked for SOC 2 or ISO 27001 evidence by customers long before they
              can afford a full GRC platform or a Big Four readiness engagement. Evidence lives in drives, wikis and
              inboxes; nobody can say which control is actually supported; and the first auditor conversation exposes
              gaps that were discoverable months earlier.
            </p>
          </div>
          <div className="surface p-5">
            <h2 className="text-[15px] font-semibold text-ink-900">Solution</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">
              ComplyLens turns the documents a team already has into a control-by-control readiness picture. Evidence is
              mapped to specific controls, each control shows what is present and what is missing, every gap becomes a
              prioritised finding with a suggested owner and timeline, and the whole workspace exports as a readiness
              report that can be shared internally or with an auditor as preparation material.
            </p>
          </div>
        </div>
      </Section>

      <Section className="border-b border-ink-200 bg-ink-50/40">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-brand-700">
              <Calculator className="size-4" aria-hidden="true" />
              <Eyebrow>Interactive business case</Eyebrow>
            </div>
            <h2 className="mt-3 text-2xl tracking-tight">Estimate the value of less manual readiness work</h2>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-ink-600">
              Adjust the assumptions to model what your team currently spends on evidence preparation. This calculator is a planning aid, not a promise of savings or a measured ComplyLens result.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-[12.5px] font-medium text-ink-700">
                People involved
                <input aria-label="People involved" type="number" min="1" max="100" value={teamSize} onChange={(event) => setTeamSize(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900" />
              </label>
              <label className="block text-[12.5px] font-medium text-ink-700">
                Hours per person / month
                <input aria-label="Hours per person per month" type="number" min="1" max="200" value={hoursPerPerson} onChange={(event) => setHoursPerPerson(Math.min(200, Math.max(1, Number(event.target.value) || 1)))} className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900" />
              </label>
              <label className="block text-[12.5px] font-medium text-ink-700">
                Loaded hourly cost (USD)
                <input aria-label="Loaded hourly cost in US dollars" type="number" min="1" max="1000" value={hourlyCost} onChange={(event) => setHourlyCost(Math.min(1000, Math.max(1, Number(event.target.value) || 1)))} className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900" />
              </label>
              <label className="block text-[12.5px] font-medium text-ink-700">
                Assumed time reduction
                <select aria-label="Assumed time reduction" value={estimatedReduction} onChange={(event) => setEstimatedReduction(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900">
                  <option value="10">10% — cautious scenario</option>
                  <option value="25">25% — planning scenario</option>
                  <option value="40">40% — optimistic scenario</option>
                </select>
              </label>
              <label className="block text-[12.5px] font-medium text-ink-700 sm:col-span-2">
                Monthly software budget assumption (USD)
                <input aria-label="Monthly software budget in US dollars" type="number" min="0" max="100000" value={monthlyToolCost} onChange={(event) => setMonthlyToolCost(Math.min(100000, Math.max(0, Number(event.target.value) || 0)))} className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900" />
              </label>
            </div>
          </div>
          <div className="surface rounded-2xl p-5 sm:p-6">
            <p className="text-[12px] font-semibold tracking-wide text-ink-500 uppercase">Your hypothetical scenario</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-ink-50 p-4">
                <p className="text-[11.5px] text-ink-500">Hours spent / month</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{estimate.monthlyHours.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-ink-50 p-4">
                <p className="text-[11.5px] text-ink-500">Potential hours freed</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{estimate.savedHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
              </div>
              <div className="rounded-xl bg-brand-50 p-4">
                <p className="text-[11.5px] text-ink-600">Estimated monthly time value</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-ink-900">{estimate.monthlyValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</p>
              </div>
              <div className="rounded-xl bg-brand-50 p-4">
                <p className="text-[11.5px] text-ink-600">Annual net scenario</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-ink-900">{estimate.annualNetValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</p>
              </div>
            </div>
            <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-ink-500">
              <TrendingUp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Calculated as assumed hours × assumed hourly cost × assumed time reduction, less the budget you entered. Actual savings, product fit, and pricing have not been independently validated.
            </p>
            <div className="mt-5">
              <DemoButton label="Test the workflow with demo data" />
            </div>
          </div>
        </div>
      </Section>

      <Section className="border-b border-ink-200">
        <h2 className="text-xl tracking-tight">Core features included</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {FEATURES.map(([name, detail]) => (
            <li key={name} className="surface flex gap-3 p-4">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
              <span>
                <span className="block text-[13.5px] font-medium text-ink-900">{name}</span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-500">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="border-b border-ink-200">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-xl tracking-tight">Technology</h2>
            <dl className="mt-5 divide-y divide-ink-200 border-y border-ink-200">
              {TECH.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_1fr] gap-3 py-3">
                  <dt className="text-[12px] font-medium tracking-wide text-ink-400 uppercase">{label}</dt>
                  <dd className="text-[13px] leading-relaxed text-ink-700">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="text-xl tracking-tight">Architecture in one paragraph</h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-600">
              A single Express process serves the JSON API and — in production — the built React client, so there is one
              origin, one port and no CORS configuration. Domain logic lives in{' '}
              <code className="rounded border border-ink-200 bg-ink-100 px-1.5 py-0.5 font-mono text-[12px]">server/src/domain</code>{' '}
              and is pure: given a control library and evidence records it returns assessments, mappings, findings and a
              readiness index. Routes only orchestrate; the store is behind an interface with in-memory and MongoDB
              implementations; PDF reports are rendered server-side with PDFKit.
            </p>
            <pre className="mt-4 overflow-x-auto scroll-area rounded-lg border border-ink-200 bg-ink-900 px-4 py-3.5 font-mono text-[11.5px] leading-relaxed text-ink-100">{`npm install
npm run dev        # development, http://localhost:4000
npm run build      # client/dist + server/dist
npm start          # production

# optional
MONGODB_URI=mongodb://...      # persistent store
SESSION_SECRET=<long random>   # stable sessions
AI_PROVIDER=openai-compatible  # optional narrative layer`}</pre>
          </div>
        </div>
      </Section>

      <Section className="border-b border-ink-200">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-xl tracking-tight">Current MVP status — stated honestly</h2>
            <ul className="mt-5 space-y-3">
              {[
                'Working end-to-end demo: landing → demo workspace → evidence → analysis → mapping → control detail → gap analysis → report PDF.',
                'Zero users, zero customers and zero revenue. There is no billing integration and no paid API usage.',
                'All workspace data is fictional sample data for the demo organisation "AcmeCloud", labelled as demo data in the UI.',
                'No customer testimonials, logos, revenue or traction claims appear anywhere in the product.',
                'The control libraries are demonstration datasets, not licensed reproductions of AICPA or ISO text.',
                'AI assistance is optional. The default analysis is deterministic and runs locally with no API key.',
                'MongoDB persistence and AI providers are implemented but optional — the app never fails without them.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink-600">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-300" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-info-100 bg-info-50 p-5">
              <h3 className="text-[14px] font-semibold text-ink-900">Target customers</h3>
              <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-600">
                <li>B2B SaaS companies between 20 and 200 employees preparing for a first SOC 2 Type I/II.</li>
                <li>Teams asked for ISO 27001 evidence by enterprise customers or a certification body.</li>
                <li>Fractional CISOs, vCISOs and boutique consultancies running readiness assessments for clients.</li>
                <li>Founders who need to answer a security questionnaire honestly and quickly.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-5">
              <h3 className="text-[14px] font-semibold text-ink-900">Potential monetisation</h3>
              <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-600">
                <li>Subscription plans already designed: $49 / $149 / $499 per month (demo pricing).</li>
                <li>Source-code asset sale with the documentation and architecture in this repository.</li>
                <li>Add-on modules: evidence automation, licensed control libraries, white-label reporting.</li>
              </ul>
              <p className="mt-3 text-[12px] text-ink-500">
                No revenue projections or valuation claims are made. These are opportunities, not forecasts.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <h2 className="text-xl tracking-tight">Future opportunities</h2>
        <p className="mt-2 text-[13.5px] text-ink-500">
          Not implemented in this MVP. Listed so the scope of the purchase is unambiguous.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OPPORTUNITIES.map((item) => (
            <li key={item} className="surface px-4 py-3.5 text-[13px] leading-relaxed text-ink-600">
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex items-start gap-3 rounded-xl border border-warn-100 bg-warn-50 px-4 py-4">
          <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-warn-700" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed text-ink-600">
            ComplyLens AI provides preliminary compliance readiness analysis and does not provide certification, audit
            opinions, or legal advice. It is not an auditor, a certification body or a legal service, and it does not
            guarantee compliance with any framework.
          </p>
        </div>
      </Section>
    </>
  );
}
