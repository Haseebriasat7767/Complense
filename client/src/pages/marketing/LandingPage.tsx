import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  GitCompareArrows,
  ScrollText,
  Sparkles,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { DashboardPreview } from '@/components/marketing/DashboardPreview';
import {
  FaqSection,
  FeaturesGrid,
  FrameworksSection,
  HowItWorksSection,
  PricingSection,
  SecuritySection,
} from '@/components/marketing/Sections';
import { DemoButton, Eyebrow, Section } from '@/components/marketing/MarketingLayout';

const CAPABILITIES = [
  { label: 'Evidence Analysis', icon: Upload },
  { label: 'Control Mapping', icon: GitCompareArrows },
  { label: 'Gap Detection', icon: TriangleAlert },
  { label: 'Remediation Planning', icon: Sparkles },
  { label: 'Readiness Reporting', icon: ScrollText },
] as const;

export function LandingPage() {
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative overflow-hidden border-b border-ink-200">
        <div className="absolute inset-0 -z-10 app-grid opacity-[0.22]" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge tone="outline" className="mb-5">
              <span className="size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
              Built for compliance readiness — not certification
            </Badge>
            <h1 className="text-[32px] leading-[1.08] font-semibold tracking-tight text-ink-900 sm:text-[46px] lg:text-[54px]">
              Know what’s missing before the auditor does.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[15.5px] leading-relaxed text-ink-600 sm:text-[17px]">
              ComplyLens AI analyzes your compliance evidence, maps it to controls, identifies gaps, and turns findings
              into an actionable readiness plan.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <DemoButton size="lg" label="Try the Demo" className="w-full sm:w-auto" />
              <ButtonLink
                to="/how-it-works"
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto"
                iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
              >
                See How It Works
              </ButtonLink>
            </div>
            <p className="mt-4 text-[12.5px] text-ink-500">
              Opens a seeded sample workspace instantly. No sign-up, no API keys, no credit card.
            </p>
          </div>

          <div className="mt-12 sm:mt-14">
            <DashboardPreview />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Social proof alternative                                           */}
      {/* ------------------------------------------------------------------ */}
      <Section className="border-b border-ink-200 py-12 sm:py-14">
        <p className="text-center text-[13px] font-medium tracking-wide text-ink-500">
          Built for teams preparing for SOC 2 and ISO 27001.
        </p>
        <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CAPABILITIES.map((capability) => (
            <li
              key={capability.label}
              className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-3.5 py-3 shadow-subtle"
            >
              <capability.icon className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span className="text-[12.5px] leading-tight font-medium text-ink-700">{capability.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-center text-[12px] text-ink-400">
          This build has no customers and no testimonials — the workspace you can open is fictional demo data.
        </p>
      </Section>

      <HowItWorksSection />
      <FeaturesGrid />

      {/* ------------------------------------------------------------------ */}
      {/* Mapping explainer                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Section className="border-y border-ink-200">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>The important part</Eyebrow>
            <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">
              Evidence → Controls → Findings
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-500">
              Most readiness work stalls because nobody can say which document supports which control. ComplyLens keeps
              that chain explicit: every document lists the controls it supports, every control lists the documents it
              is missing, and every gap becomes a finding you can assign.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Per-control view of matched and missing evidence items',
                'Mapping confidence so weak matches are visible, not hidden',
                'Documents flagged for manual review never silently close a control',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13.5px] text-ink-600">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <ButtonLink to="/features" variant="secondary" iconRight={<ArrowRight className="size-4" />}>
                Explore the product
              </ButtonLink>
            </div>
          </div>

          <div className="surface overflow-hidden">
            <div className="border-b border-ink-200 bg-ink-50/60 px-4 py-3">
              <p className="font-mono text-[11.5px] text-ink-500">access_control_policy.pdf</p>
            </div>
            <div className="space-y-3 p-4">
              {[
                { code: 'SOC2-CC6.1', name: 'Logical Access Security', status: 'Partial', tone: 'warn', confidence: 57 },
                { code: 'SOC2-CC6.2', name: 'User Registration & Authorization', status: 'Passed', tone: 'pass', confidence: 88 },
                { code: 'SOC2-CC6.3', name: 'Role-Based Access', status: 'Passed', tone: 'pass', confidence: 82 },
                { code: 'ISO-A.5.16', name: 'Identity Management', status: 'Passed', tone: 'pass', confidence: 79 },
              ].map((row) => (
                <div key={row.code} className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white px-3 py-2.5">
                  <span className="font-mono text-[11px] text-ink-400">{row.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-800">{row.name}</span>
                  <span className="hidden text-[11.5px] text-ink-500 sm:block">{row.confidence}%</span>
                  <Badge tone={row.tone === 'warn' ? 'warn' : 'pass'} size="sm">
                    {row.status}
                  </Badge>
                </div>
              ))}
              <p className="pt-1 text-[12px] leading-relaxed text-ink-500">
                <TriangleAlert className="mr-1.5 inline size-3.5 text-warn-600" aria-hidden="true" />
                The policy supports two access controls fully and one partially — no evidence of periodic access reviews
                was found, so the finding is raised automatically.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <FrameworksSection />
      <SecuritySection />

      {/* ------------------------------------------------------------------ */}
      {/* Dashboard metrics section                                          */}
      {/* ------------------------------------------------------------------ */}
      <Section className="border-y border-ink-200">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.25fr] lg:items-center">
          <div>
            <Eyebrow>Inside the workspace</Eyebrow>
            <h2 className="mt-3 text-2xl tracking-tight sm:text-3xl">A dashboard that answers one question first</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
              How ready are we right now? The numbers below come from the seeded demo workspace, and every one of them
              can be traced to a document or a missing document.
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Readiness score', value: '92%', tone: 'text-pass-700' },
                { label: 'Controls reviewed', value: '24' },
                { label: 'Passed', value: '18', tone: 'text-pass-700' },
                { label: 'Needs attention', value: '4', tone: 'text-warn-700' },
                { label: 'Critical gaps', value: '2', tone: 'text-danger-700' },
                { label: 'Evidence documents', value: '10' },
              ].map((metric) => (
                <div key={metric.label} className="surface px-3.5 py-3">
                  <dt className="text-[11px] tracking-wide text-ink-500 uppercase">{metric.label}</dt>
                  <dd className={`metric-value mt-1.5 text-xl ${metric.tone ?? ''}`}>{metric.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[12px] text-ink-400">
              Sample workspace figures. Demo data — no customer data is used anywhere in this product.
            </p>
          </div>
          <DashboardPreview />
        </div>
      </Section>

      <PricingSection />
      <FaqSection />

      {/* ------------------------------------------------------------------ */}
      {/* Closing CTA                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Section className="border-t border-ink-200 bg-ink-900 py-16 text-center sm:py-20">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl tracking-tight text-white sm:text-3xl">
            See your readiness gaps in about a minute
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-300">
            The demo workspace is already populated with sample evidence, controls and findings — open it and follow the
            full journey through to a readiness report.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <DemoButton size="lg" label="Open the demo workspace" />
            <Link
              to="/documentation"
              className="text-[13.5px] font-medium text-ink-300 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Read the documentation
            </Link>
          </div>
          <p className="mt-6 text-[12px] text-ink-400">
            ComplyLens AI provides preliminary compliance readiness analysis and does not provide certification, audit
            opinions, or legal advice.
          </p>
        </div>
      </Section>
    </>
  );
}
