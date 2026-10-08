import { DemoButton, Eyebrow, Section } from '@/components/marketing/MarketingLayout';
import { FaqSection } from '@/components/marketing/Sections';

export function FaqPage() {
  return (
    <>
      <Section className="border-b border-ink-200 pb-10">
        <div className="max-w-2xl">
          <Eyebrow>FAQ</Eyebrow>
          <h1 className="mt-3 text-3xl tracking-tight sm:text-4xl">Frequently asked questions</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-500">
            Including the questions a buyer should ask before relying on any readiness tool — ours included.
          </p>
        </div>
      </Section>
      <FaqSection heading={false} />

      <Section className="border-t border-ink-200 bg-ink-50/50">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl tracking-tight">Still deciding?</h2>
          <p className="mt-3 text-[14px] text-ink-500">
            The fastest way to evaluate ComplyLens is to open the seeded workspace and try to break the analysis — it is
            deterministic, so you will get the same answers every time.
          </p>
          <div className="mt-6 flex justify-center">
            <DemoButton size="lg" label="Open the demo workspace" />
          </div>
        </div>
      </Section>
    </>
  );
}
