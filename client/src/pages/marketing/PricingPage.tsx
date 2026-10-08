import { CheckCircle2, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DemoButton, Eyebrow, Section } from '@/components/marketing/MarketingLayout';
import { FaqSection, PricingSection } from '@/components/marketing/Sections';

const COMPARISON: Array<{ feature: string; starter: boolean | string; growth: boolean | string; business: boolean | string }> = [
  { feature: 'Frameworks', starter: '1', growth: '2', business: '2 + custom' },
  { feature: 'Workspaces', starter: '1', growth: '3', business: 'Unlimited' },
  { feature: 'Evidence documents', starter: '50', growth: 'Unlimited', business: 'Unlimited' },
  { feature: 'Deterministic gap analysis', starter: true, growth: true, business: true },
  { feature: 'Evidence-to-control mapping', starter: true, growth: true, business: true },
  { feature: 'Readiness report PDF', starter: true, growth: true, business: true },
  { feature: 'Report history and snapshots', starter: false, growth: true, business: true },
  { feature: 'Remediation owners and timelines', starter: false, growth: true, business: true },
  { feature: 'Vendor evidence packs', starter: false, growth: false, business: true },
  { feature: 'Scheduled assessments (roadmap)', starter: false, growth: false, business: 'Planned' },
  { feature: 'SSO and audit trail (roadmap)', starter: false, growth: false, business: 'Planned' },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle2 className="size-4 text-pass-600" aria-label="Included" />;
  if (value === false) return <Minus className="size-4 text-ink-300" aria-label="Not included" />;
  return <span className="text-[12.5px] text-ink-600">{value}</span>;
}

export function PricingPage() {
  return (
    <>
      <Section className="border-b border-ink-200 pb-10">
        <div className="max-w-2xl">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="mt-3 text-3xl tracking-tight sm:text-4xl">Plans that match how readiness work happens</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-500">
            Start with one framework and a single workspace. Move up when you need a second framework, more evidence and
            report history.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <Badge tone="info">Demo pricing</Badge>
            <span className="text-[12.5px] text-ink-500">
              Billing is not connected in this build — nothing is charged and every plan opens the demo workspace.
            </span>
          </div>
        </div>
      </Section>

      <PricingSection heading={false} />

      <Section className="border-y border-ink-200 bg-ink-50/50">
        <h2 className="text-xl tracking-tight">Plan comparison</h2>
        <p className="mt-2 text-[13.5px] text-ink-500">
          The table below describes the plans the product is designed around. Limits are enforced in the roadmap
          versions; this demo does not gate features.
        </p>

        <div className="surface mt-6 overflow-x-auto scroll-area">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">Plan comparison</caption>
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50/60">
                <th scope="col" className="px-4 py-3 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
                  Capability
                </th>
                {['Starter · $49', 'Growth · $149', 'Business · $499'].map((plan) => (
                  <th key={plan} scope="col" className="px-4 py-3 text-[12px] font-semibold tracking-wide text-ink-500 uppercase">
                    {plan}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature} className="border-b border-ink-200 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-[13px] font-normal text-ink-700">
                    {row.feature}
                  </th>
                  <td className="px-4 py-2.5">
                    <Cell value={row.starter} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Cell value={row.growth} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Cell value={row.business} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <DemoButton label="Try the Demo" />
          <span className="text-[12.5px] text-ink-500">
            Buying instead of demoing? The product overview page documents what is included in the source.
          </span>
        </div>
      </Section>

      <FaqSection />
    </>
  );
}
