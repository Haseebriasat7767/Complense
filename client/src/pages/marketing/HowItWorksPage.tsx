import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { DashboardPreview } from '@/components/marketing/DashboardPreview';
import { DemoButton, Eyebrow, Section } from '@/components/marketing/MarketingLayout';
import { HowItWorksSection } from '@/components/marketing/Sections';

const JOURNEY = [
  { step: 'Open the demo', detail: 'One click issues a session for the seeded AcmeCloud demo workspace — no sign-up.' },
  { step: 'Review the dashboard', detail: 'Readiness index, controls reviewed, passed, needs attention and critical gaps.' },
  { step: 'Open Evidence', detail: 'Ten sample documents with analysis statuses, categories and extracted text previews.' },
  { step: 'Run an analysis', detail: 'Re-analyze a document and watch its mapping and status update deterministically.' },
  { step: 'Inspect the mapping', detail: 'See which controls each document supports, with per-control confidence.' },
  { step: 'Read a control', detail: 'Evidence found, evidence missing, analysis note and the recommended action.' },
  { step: 'Work the gaps', detail: 'Filter findings by risk and owner, and read the remediation guidance for each one.' },
  { step: 'Generate a report', detail: 'Create a readiness report and download the PDF, disclaimer included.' },
];

export function HowItWorksPage() {
  return (
    <>
      <Section className="border-b border-ink-200 pb-12">
        <div className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-3 text-3xl tracking-tight sm:text-4xl">
            Upload evidence, see the gaps, close them in order
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-500">
            ComplyLens is deliberately simple. No questionnaire, no integration project — start with the documents your
            team already has and improve from there.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <DemoButton label="Try the Demo" />
            <ButtonLink to="/pricing" variant="secondary" iconRight={<ArrowRight className="size-4" />}>
              See pricing
            </ButtonLink>
          </div>
        </div>
      </Section>

      <HowItWorksSection />

      <Section className="border-y border-ink-200 bg-ink-50/50">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Eyebrow>The full journey</Eyebrow>
            <h2 className="mt-3 text-2xl tracking-tight">What the demo walkthrough looks like</h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-500">
              Every step below works with no configuration: no API key, no database, no paid service. Data is held in
              memory, so a restart returns the demo workspace to its seeded state.
            </p>
          </div>
          <ol className="surface divide-y divide-ink-200">
            {JOURNEY.map((item, index) => (
              <li key={item.step} className="flex gap-4 px-5 py-3.5">
                <span className="tnum mt-0.5 font-mono text-[11.5px] text-ink-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="block text-[13.5px] font-medium text-ink-900">{item.step}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-500">{item.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl tracking-tight">Want to see it first?</h2>
          <p className="mt-3 text-[14.5px] text-ink-500">
            The demo workspace already contains the state described above — 92% readiness on SOC 2 with two critical gaps.
          </p>
          <div className="mt-6 flex justify-center">
            <DemoButton size="lg" label="Open the demo workspace" />
          </div>
        </div>
        <div className="mt-12">
          <DashboardPreview />
        </div>
      </Section>
    </>
  );
}
