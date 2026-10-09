import { ShieldAlert } from 'lucide-react';
import { DemoButton, Eyebrow, Section } from '@/components/marketing/MarketingLayout';
import { SecuritySection } from '@/components/marketing/Sections';

const DATA_HANDLING = [
  {
    title: 'What is stored',
    body: 'Organisation, user, workspace, evidence metadata and the extracted text of uploaded documents (or the seeded demo text). Passwords are stored only as scrypt hashes.',
  },
  {
    title: 'What is not stored',
    body: 'The original uploaded binary is parsed in memory and discarded. No file is written to disk, and there is no endpoint that serves a raw uploaded file back.',
  },
  {
    title: 'Where it lives',
    body: 'Without configuration, everything lives in the server process memory and disappears on restart. Set SUPABASE_URL and SUPABASE_SECRET_KEY to persist to your own Supabase PostgreSQL project. Production refuses to start on the in-memory store.',
  },
  {
    title: 'Who can read it',
    body: 'Every query is scoped to the organisation id inside the signed session token. A token for one organisation cannot read another organisation’s evidence or reports.',
  },
];

export function SecurityPage() {
  return (
    <>
      <Section className="border-b border-ink-200 pb-12">
        <div className="max-w-2xl">
          <Eyebrow>Security</Eyebrow>
          <h1 className="mt-3 text-3xl tracking-tight sm:text-4xl">Security posture, described plainly</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-500">
            Compliance evidence is sensitive, so the product should be honest about what it does. Below is the
            implementation in this codebase — and what it does not claim.
          </p>
          <div className="mt-6">
            <DemoButton label="Try the Demo" />
          </div>
        </div>
      </Section>

      <SecuritySection />

      <Section className="border-t border-ink-200">
        <h2 className="text-xl tracking-tight">Evidence handling</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {DATA_HANDLING.map((item) => (
            <div key={item.title} className="surface p-5">
              <h3 className="text-[14px] font-semibold text-ink-900">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-warn-100 bg-warn-50 px-4 py-4">
          <ShieldAlert className="mt-0.5 size-4.5 shrink-0 text-warn-700" aria-hidden="true" />
          <div>
            <p className="text-[13.5px] font-medium text-ink-900">No certifications are claimed</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
              ComplyLens AI is not SOC 2 certified, ISO 27001 certified or FedRAMP authorised, and it does not claim
              compliance with any framework. The product performs a readiness assessment of <em>your</em> evidence; it does
              not assess itself, and it is not a substitute for an external auditor or legal advice.
            </p>
          </div>
        </div>
      </Section>

      <Section className="border-t border-ink-200 bg-ink-50/50">
        <h2 className="text-xl tracking-tight">Deployment hardening checklist</h2>
        <p className="mt-2 text-[13.5px] text-ink-500">
          What to do before putting this in front of real evidence:
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            'Set SESSION_SECRET to a long random value so sessions survive restarts and cannot be forged.',
            'Set AUTH_REQUIRED=true and DEMO_MODE=false to disable passwordless demo entry.',
            'Point SUPABASE_URL at a project with Row Level Security enabled, keep SUPABASE_SECRET_KEY server-side only, and enable backups.',
            'Terminate TLS at a trusted reverse proxy; set TRUST_PROXY_HOPS to the exact trusted proxy count (default 0).',
            'Leave AI_ALLOW_EXTERNAL=false unless you have a data-processing agreement covering evidence text.',
            'Review the upload limits and allowed file types for your evidence types.',
          ].map((item) => (
            <li key={item} className="surface px-4 py-3 text-[13px] leading-relaxed text-ink-600">
              {item}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
