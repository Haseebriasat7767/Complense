import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  FileCheck2,
  GitCompareArrows,
  KeyRound,
  Layers,
  Lock,
  ScrollText,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { DemoButton, Eyebrow, Section } from './MarketingLayout';

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */

export const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Upload',
    description:
      'Upload the policies, procedures, records and reports your team already maintains. PDF, DOCX, TXT and CSV are supported, and every document is labelled with the framework it should support.',
    icon: Upload,
    detail: ['Drag and drop or browse', 'Framework and category tagging', 'Extraction quality reported per file'],
  },
  {
    step: '02',
    title: 'Analyze',
    description:
      'ComplyLens maps each document against the evidence each control expects, then derives a status per control with the matching and missing items shown side by side.',
    icon: GitCompareArrows,
    detail: ['Evidence-to-control mapping', 'Passed, partial and missing detection', 'Confidence per control'],
  },
  {
    step: '03',
    title: 'Act',
    description:
      'Work the prioritised gap list: each finding carries a recommended fix, a suggested owner and a timeline. When the workspace looks right, generate a readiness report.',
    icon: FileCheck2,
    detail: ['Risk-rated findings', 'Suggested remediation owners', 'Executive-ready PDF report'],
  },
] as const;

export function HowItWorksSection({ compact = false }: { compact?: boolean }) {
  return (
    <Section className={compact ? 'py-14' : undefined} id="how-it-works">
      <div className="max-w-2xl">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">From scattered evidence to a readiness plan</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
          Three steps, no auditors required. ComplyLens shows the state of every control you can evidence today — and
          what is still missing.
        </p>
      </div>

      <ol className="mt-10 grid gap-5 md:grid-cols-3">
        {HOW_IT_WORKS_STEPS.map((step) => (
          <li key={step.step} className="surface p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px] font-semibold text-ink-400">{step.step}</span>
              <span className="flex size-8 items-center justify-center rounded-lg border border-ink-200 bg-ink-50 text-ink-600">
                <step.icon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <h3 className="mt-4 text-[15px] font-semibold text-ink-900">{step.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">{step.description}</p>
            <ul className="mt-4 space-y-1.5 border-t border-ink-200 pt-3.5">
              {step.detail.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12.5px] text-ink-600">
                  <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Features                                                                   */
/* -------------------------------------------------------------------------- */

export const FEATURES = [
  {
    title: 'Evidence Analysis',
    description: 'Organize and analyze compliance evidence from one workspace.',
    icon: FileCheck2,
  },
  {
    title: 'Evidence-to-Control Mapping',
    description: 'Understand which controls your evidence supports — and where it falls short.',
    icon: GitCompareArrows,
  },
  {
    title: 'Gap Analysis',
    description: 'See missing, partial, and high-risk controls at a glance.',
    icon: TriangleAlert,
  },
  {
    title: 'Risk Prioritization',
    description: 'Focus remediation efforts on the issues that matter most.',
    icon: Layers,
  },
  {
    title: 'Remediation Recommendations',
    description: 'Turn findings into practical next steps.',
    icon: Sparkles,
  },
  {
    title: 'Readiness Reports',
    description: 'Generate a professional compliance readiness report.',
    icon: ScrollText,
  },
] as const;

export function FeaturesGrid() {
  return (
    <Section id="features" className="bg-ink-50/50">
      <div className="max-w-2xl">
        <Eyebrow>Product</Eyebrow>
        <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">
          Everything a readiness assessment needs
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
          Built for teams who need to see progress quickly, not for a six-week implementation project.
        </p>
      </div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="surface group p-5 transition-shadow hover:shadow-raised">
            <span className="flex size-9 items-center justify-center rounded-lg border border-ink-200 bg-white text-brand-700">
              <feature.icon className="size-4.5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-[14.5px] font-semibold text-ink-900">{feature.title}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">{feature.description}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Frameworks                                                                 */
/* -------------------------------------------------------------------------- */

export function FrameworksSection() {
  const frameworks = [
    {
      name: 'SOC 2',
      version: 'AICPA Trust Services Criteria (2017, 2022 revision)',
      controls: 28,
      categories: 12,
      readiness: 92,
      description:
        'Security, availability and confidentiality criteria that B2B customers ask about during vendor due diligence.',
    },
    {
      name: 'ISO 27001',
      version: 'ISO/IEC 27001:2022 Annex A',
      controls: 22,
      categories: 9,
      readiness: 78,
      description:
        'Organisational, people and technology controls from the international information security standard.',
    },
  ];

  return (
    <Section id="frameworks">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Eyebrow>Frameworks</Eyebrow>
          <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">Two frameworks, one evidence library</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
            The same documents can support both frameworks. ComplyLens keeps the status per framework so you always know
            which audit you are preparing for.
          </p>
        </div>
        <Badge tone="brand" className="w-fit">
          Readiness assessment
        </Badge>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {frameworks.map((framework) => (
          <div key={framework.name} className="surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[17px] font-semibold text-ink-900">{framework.name}</h3>
                <p className="mt-0.5 text-[12px] text-ink-400">{framework.version}</p>
              </div>
              <Badge tone="pass" size="sm">
                Ready for demo
              </Badge>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-500">{framework.description}</p>
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-ink-200 pt-4">
              <div>
                <dt className="text-[11px] tracking-wide text-ink-400 uppercase">Controls</dt>
                <dd className="metric-value mt-1 text-lg">{framework.controls}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-ink-400 uppercase">Categories</dt>
                <dd className="metric-value mt-1 text-lg">{framework.categories}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-ink-400 uppercase">Demo score</dt>
                <dd className="metric-value mt-1 text-lg text-brand-700">{framework.readiness}%</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[12.5px] text-ink-500">
        Framework support in this build is a readiness assessment against a demo control library. ComplyLens does not
        certify organisations or issue audit opinions.
      </p>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

export const SECURITY_ITEMS = [
  {
    title: 'Secure authentication architecture',
    description:
      'Passwords are hashed with scrypt. Sessions are signed HS256 tokens with an expiry, issued server-side and stored only in the browser.',
    icon: KeyRound,
  },
  {
    title: 'Protected routes and organisation scoping',
    description:
      'The application shell requires a valid session. Every API query is scoped to the organisation on the token, so one tenant cannot read another tenant’s evidence.',
    icon: Lock,
  },
  {
    title: 'Controlled file uploads',
    description:
      'Uploads are limited by extension and size, validated on the server, parsed in memory and never written to disk or exposed as raw files.',
    icon: Upload,
  },
  {
    title: 'Server-side validation',
    description:
      'Every request body is validated on the server before it reaches the domain layer. Clients receive safe error messages with machine-readable codes.',
    icon: ServerCog,
  },
  {
    title: 'Environment-based secrets',
    description:
      'No API keys, database credentials or signing secrets are compiled into frontend code. Everything comes from environment variables.',
    icon: ShieldCheck,
  },
  {
    title: 'Rate limiting and security headers',
    description:
      'Baseline hardening is on by default: content-type protection, frame and referrer policies, and per-IP rate limits on authentication.',
    icon: Lock,
  },
] as const;

export function SecuritySection({ heading = true }: { heading?: boolean }) {
  return (
    <Section id="security" className="bg-ink-50/50">
      {heading ? (
        <div className="max-w-2xl">
          <Eyebrow>Security</Eyebrow>
          <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">Built to handle evidence responsibly</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
            ComplyLens is a readiness tool, so it holds sensitive material. These are the controls implemented in this
            build — described honestly, without certification claims.
          </p>
        </div>
      ) : null}
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECURITY_ITEMS.map((item) => (
          <li key={item.title} className="surface p-5">
            <span className="flex size-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700">
              <item.icon className="size-4" aria-hidden="true" />
            </span>
            <h3 className="mt-3.5 text-[14px] font-semibold text-ink-900">{item.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{item.description}</p>
          </li>
        ))}
      </ul>
      <p className="mt-5 max-w-3xl text-[12.5px] leading-relaxed text-ink-500">
        This product is not SOC 2 certified, ISO 27001 certified or FedRAMP authorised, and it does not claim to be. The
        descriptions above reflect the implementation in this codebase.
      </p>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Pricing                                                                    */
/* -------------------------------------------------------------------------- */

export type PricingPlan = {
  name: string;
  price: number;
  tagline: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    name: 'Starter',
    price: 49,
    tagline: 'For a first readiness pass on one framework.',
    features: [
      '1 workspace, 1 framework',
      'Up to 50 evidence documents',
      'Deterministic gap analysis',
      'Readiness report PDF',
      'Email support (demo)',
    ],
    cta: 'Try Demo',
  },
  {
    name: 'Growth',
    price: 149,
    tagline: 'For teams preparing for two frameworks at once.',
    features: [
      '3 workspaces, both frameworks',
      'Unlimited evidence documents',
      'Evidence-to-control mapping view',
      'Remediation planning with owners',
      'Report history and snapshots',
      'Priority support (demo)',
    ],
    cta: 'Try Demo',
    highlighted: true,
  },
  {
    name: 'Business',
    price: 499,
    tagline: 'For organisations with audit support obligations.',
    features: [
      'Unlimited workspaces and frameworks',
      'Vendor and subprocessor evidence packs',
      'Scheduled assessments (roadmap)',
      'SSO and audit trail (roadmap)',
      'Guided implementation session (demo)',
    ],
    cta: 'Try Demo',
  },
] as const;

export function PricingSection({ heading = true }: { heading?: boolean }) {
  return (
    <Section id="pricing">
      {heading ? (
        <div className="max-w-2xl">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">Simple plans, no procurement theatre</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
            These are the plans the product is built around. Billing is not connected in this build — every plan opens
            the same demo workspace.
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        <Badge tone="info">Demo pricing</Badge>
        <span className="text-[12.5px] text-ink-500">No payment provider is connected. Nothing is charged.</span>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              'relative flex flex-col p-5',
              plan.highlighted ? 'surface border-ink-900/15 shadow-raised ring-1 ring-ink-900/5' : 'surface',
            )}
          >
            {plan.highlighted ? (
              <span className="absolute -top-3 left-5">
                <Badge tone="brand" size="sm">
                  Most demoed
                </Badge>
              </span>
            ) : null}
            <h3 className="text-[15px] font-semibold text-ink-900">{plan.name}</h3>
            <p className="mt-1 min-h-10 text-[13px] text-ink-500">{plan.tagline}</p>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="metric-value text-3xl">${plan.price}</span>
              <span className="text-[13px] text-ink-500">/month</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2 border-t border-ink-200 pt-4">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-[13px] text-ink-600">
                  <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <DemoButton fullWidth label={plan.cta} variant={plan.highlighted ? 'primary' : 'secondary'} />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */

export const FAQ_ITEMS = [
  {
    question: 'What is ComplyLens AI?',
    answer:
      'ComplyLens AI is a compliance readiness and gap-analysis workspace for SOC 2 and ISO 27001. You upload the evidence your team already maintains — policies, procedures, records — and ComplyLens maps it to controls, reports which controls are evidenced, which are only partially supported and which have no evidence at all, then suggests what to fix first.',
  },
  {
    question: 'Does ComplyLens certify my company?',
    answer:
      'No. ComplyLens produces a readiness assessment to help you prepare. Certification and audit opinions can only be issued by a licensed auditor or certification body. Nothing in this product should be presented to a customer or regulator as a certification.',
  },
  {
    question: 'What frameworks are supported?',
    answer:
      'The MVP ships a demo control library for SOC 2 (AICPA Trust Services Criteria) and ISO/IEC 27001:2022 Annex A: 28 SOC 2 criteria and 22 ISO 27001 Annex A controls across 14 categories. The libraries are demonstration data and can be replaced with a licensed control set — the analysis engine reads from a single control library module.',
  },
  {
    question: 'Can I use it without an AI API?',
    answer:
      'Yes — that is the default. ComplyLens ships with a deterministic analysis engine that runs entirely on your server and needs no external service. The interface reports "Demo Analysis Mode". If you configure an OpenAI-compatible provider and explicitly allow external calls, the product uses it to improve report wording; the assessment itself stays deterministic so results never change between runs.',
  },
  {
    question: 'What happens to uploaded evidence?',
    answer:
      'Files are validated by type and size, parsed in memory, and only the extracted text is stored in your own database — the original binary is not retained or made downloadable. Uploads are scoped to your organisation by the session token, and evidence text is never sent to a third-party provider unless you enable the optional AI provider.',
  },
  {
    question: 'Can I export reports?',
    answer:
      'Yes. Any framework in the workspace can be turned into a PDF readiness report with a cover page, executive summary, control summary, critical and high-risk findings, remediation recommendations and the full evidence inventory — including the disclaimer that the report is a preliminary assessment, not an audit opinion.',
  },
] as const;

export function FaqSection({ heading = true }: { heading?: boolean }) {
  const [open, setOpen] = useState<string | null>(FAQ_ITEMS[0].question);

  return (
    <Section id="faq">
      {heading ? (
        <div className="max-w-2xl">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">Questions buyers and teams ask</h2>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="divide-y divide-ink-200 border-y border-ink-200">
          {FAQ_ITEMS.map((item) => {
            const isOpen = open === item.question;
            return (
              <div key={item.question}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : item.question)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start justify-between gap-4 py-4 text-left"
                >
                  <span className="text-[14.5px] font-medium text-ink-900">{item.question}</span>
                  <ChevronDown
                    className={cn('mt-0.5 size-4 shrink-0 text-ink-400 transition-transform', isOpen && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>
                {isOpen ? (
                  <p className="animate-fade pb-4 text-[13.5px] leading-relaxed text-ink-500">{item.answer}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        <aside className="surface h-fit p-5">
          <h3 className="text-[14px] font-semibold text-ink-900">Looking for the technical detail?</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
            The documentation covers the architecture, API surface, data model, the analysis engine and the deployment
            path for Vercel and Railway.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <ButtonLink to="/documentation" variant="primary" fullWidth iconRight={<ArrowRight className="size-4" />}>
              Read the documentation
            </ButtonLink>
            <ButtonLink to="/overview" variant="secondary" fullWidth>
              Product overview for buyers
            </ButtonLink>
          </div>
        </aside>
      </div>
    </Section>
  );
}
