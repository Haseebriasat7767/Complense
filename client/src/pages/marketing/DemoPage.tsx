import { ArrowRight, Download, FileText, ShieldCheck } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Eyebrow, Section } from '@/components/marketing/MarketingLayout';
import { useApi } from '@/lib/api';

type DemoFramework = {
  frameworkKey: string;
  frameworkName: string;
  index: number;
  band: string;
  bandLabel: string;
  counts: { total: number; reviewed: number; passed: number; needsAttention: number; missing: number; needsReview: number };
  openFindings: number;
  topFindings: Array<{
    id: string;
    controlCode: string;
    controlName: string;
    title: string;
    riskLevel: string;
    priority: string;
    recommendation: string;
    timelineLabel: string;
  }>;
};

type DemoReadiness = {
  demo: boolean;
  companyName: string;
  workspaceLabel: string;
  note: string;
  generatedAt: string;
  frameworks: { soc2: DemoFramework; iso27001: DemoFramework };
  documents: Array<{ fileName: string; category: string; status: string; summary: string; uploadedAt: string }>;
};

function riskTone(riskLevel: string): string {
  if (riskLevel === 'critical') return 'bg-red-100 text-red-800';
  if (riskLevel === 'high') return 'bg-orange-100 text-orange-800';
  if (riskLevel === 'medium') return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
}

function FrameworkCard({ framework }: { framework: DemoFramework }) {
  return (
    <article className="surface overflow-hidden">
      <div className="border-b border-ink-200 px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-ink-900">{framework.frameworkName}</h3>
          <span className="tnum text-2xl font-semibold text-ink-900">{framework.index}%</span>
        </div>
        <p className="mt-1 text-[13px] text-ink-500">
          {framework.bandLabel} · {framework.counts.reviewed} of {framework.counts.total} controls reviewed ·{' '}
          {framework.counts.passed} passed · {framework.openFindings} open findings
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-teal-700" style={{ width: `${framework.index}%` }} />
        </div>
        <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
          <div>
            <dt className="text-[11px] text-ink-400">Passed</dt>
            <dd className="tnum text-[15px] font-semibold text-ink-900">{framework.counts.passed}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-400">Needs attention</dt>
            <dd className="tnum text-[15px] font-semibold text-ink-900">{framework.counts.needsAttention}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-400">Missing</dt>
            <dd className="tnum text-[15px] font-semibold text-ink-900">{framework.counts.missing}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-400">Needs review</dt>
            <dd className="tnum text-[15px] font-semibold text-ink-900">{framework.counts.needsReview}</dd>
          </div>
        </dl>
      </div>
      <ul className="divide-y divide-ink-200">
        {framework.topFindings.map((finding) => (
          <li key={finding.id} className="px-5 py-3.5">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${riskTone(finding.riskLevel)}`}>
                {finding.riskLevel}
              </span>
              <span className="font-mono text-[11.5px] text-ink-400">{finding.controlCode}</span>
              <span className="ml-auto text-[11.5px] text-ink-400">{finding.priority}</span>
            </div>
            <p className="mt-1.5 text-[13.5px] font-medium text-ink-900">{finding.title}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">
              {finding.recommendation} · {finding.timelineLabel}
            </p>
          </li>
        ))}
      </ul>
      <div className="border-t border-ink-200 px-5 py-3.5">
        <a
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-teal-700 hover:underline"
          href={`/api/demo/report.pdf?framework=${framework.frameworkKey}`}
        >
          <Download className="size-4" /> Download the {framework.frameworkName} sample PDF report
        </a>
      </div>
    </article>
  );
}

export function DemoPage() {
  const { data, error, loading } = useApi<DemoReadiness>('/api/demo/readiness', { auth: false });

  return (
    <>
      <Section className="border-b border-ink-200 pb-12">
        <div className="max-w-2xl">
          <Eyebrow>Live demo — no sign-up</Eyebrow>
          <h1 className="mt-3 text-3xl tracking-tight sm:text-4xl">See a real readiness assessment, before you sign in</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-500">
            This is the AcmeCloud demo workspace: ten fictional documents run through the same deterministic engine as
            a signed-in workspace. The scores below are computed live, not screenshots — and you can download the
            sample PDF report to show your auditor.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink to="/signup">Create an account</ButtonLink>
            <ButtonLink to="/pricing" variant="secondary" iconRight={<ArrowRight className="size-4" />}>
              See pricing
            </ButtonLink>
          </div>
        </div>
      </Section>

      <Section>
        {loading && <p className="text-[14px] text-ink-500">Loading the demo workspace…</p>}
        {error && (
          <p className="text-[14px] text-red-700">
            The demo could not be loaded right now ({error.message}). Please try again, or create an account to see
            your own workspace.
          </p>
        )}
        {data && (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-[13.5px] text-teal-900">
              <ShieldCheck className="size-4 shrink-0" />
              <span>
                <strong>Demo data.</strong> AcmeCloud is fictional; no real company data is shown here. {data.note}
              </span>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <FrameworkCard framework={data.frameworks.soc2} />
              <FrameworkCard framework={data.frameworks.iso27001} />
            </div>

            <h2 className="mt-10 text-2xl tracking-tight">Evidence in the demo workspace</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-500">
              {data.documents.length} documents, mapped to SOC 2 and ISO 27001 controls by the deterministic engine.
            </p>
            <ul className="surface mt-4 divide-y divide-ink-200">
              {data.documents.map((doc) => (
                <li key={doc.fileName} className="flex gap-3 px-5 py-3.5">
                  <FileText className="mt-0.5 size-4 shrink-0 text-ink-400" />
                  <div>
                    <p className="text-[13.5px] font-medium text-ink-900">
                      {doc.fileName} <span className="font-normal text-ink-400">· {doc.category} · {doc.status}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-500">{doc.summary}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12.5px] text-ink-400">
              Scores computed {new Date(data.generatedAt).toLocaleString('en-GB')}. Demo workspaces are read-only —
              create an account to upload your own evidence.
            </p>
          </>
        )}
      </Section>
    </>
  );
}
