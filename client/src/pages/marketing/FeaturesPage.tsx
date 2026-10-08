import { ArrowRight, BadgeCheck } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { DemoButton, Eyebrow, Section } from '@/components/marketing/MarketingLayout';
import { FeaturesGrid } from '@/components/marketing/Sections';

const DEEP_DIVES = [
  {
    title: 'Evidence workspace',
    body: 'Upload PDF, DOCX, TXT and CSV files with the framework and category they belong to. Every document shows its analysis status, extraction quality, upload date and the controls it supports.',
    points: [
      'Drag-and-drop uploader with server-side type and size validation',
      'Analyzed, Analyzing, Needs review and Failed states',
      'Re-run analysis or delete a document at any time',
    ],
  },
  {
    title: 'Control library',
    body: 'A read-only demo library of 28 SOC 2 criteria and 22 ISO 27001 Annex A controls across 14 categories, each with a description, risk level, required evidence and a readiness status.',
    points: [
      'Passed, Partial, Missing and Needs review statuses',
      'Control detail with evidence found, evidence missing and analysis notes',
      'Replaceable control library — the engine reads from one module',
    ],
  },
  {
    title: 'Gap analysis and remediation',
    body: 'Every control that is not fully evidenced becomes a finding with an escalated or reduced risk rating, a priority, and a recommendation carrying a suggested owner and timeline.',
    points: [
      'Filter by framework, risk, status, category, owner and priority',
      'Deterministic severity model — missing evidence escalates risk',
      'Remediation guidance labelled as generated advice',
    ],
  },
  {
    title: 'Readiness reports',
    body: 'Generate a PDF snapshot of the workspace: cover page, executive summary, control summary, critical and high-risk findings, remediation plan and the evidence inventory.',
    points: [
      'Server-side PDF generation — identical output in every browser',
      'Stored snapshots so historical reports stay comparable',
      'Disclaimer included on the cover and in the footer of every page',
    ],
  },
];

export function FeaturesPage() {
  return (
    <>
      <Section className="border-b border-ink-200 pb-12">
        <div className="max-w-2xl">
          <Eyebrow>Product</Eyebrow>
          <h1 className="mt-3 text-3xl tracking-tight sm:text-4xl">
            A readiness workspace, not another policy folder
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-500">
            ComplyLens connects the documents you already have to the controls an auditor will ask about — and shows you
            the distance between the two.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <DemoButton label="Try the Demo" />
            <ButtonLink to="/how-it-works" variant="secondary" iconRight={<ArrowRight className="size-4" />}>
              See How It Works
            </ButtonLink>
          </div>
        </div>
      </Section>

      <FeaturesGrid />

      <Section>
        <div className="space-y-6">
          {DEEP_DIVES.map((item) => (
            <article key={item.title} className="surface grid gap-5 p-5 lg:grid-cols-[1fr_1.1fr] lg:p-6">
              <div>
                <h2 className="text-[17px] font-semibold text-ink-900">{item.title}</h2>
              </div>
              <div>
                <p className="text-[13.5px] leading-relaxed text-ink-600">{item.body}</p>
                <ul className="mt-4 space-y-2">
                  {item.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[13px] text-ink-500">
                      <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
