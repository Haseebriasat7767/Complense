import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, FileText, Sparkles, UserRound } from 'lucide-react';
import { Badge, PriorityBadge, RiskBadge, StatusBadge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ErrorState, InlineAlert, LoadingBlock } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/app/PageHeader';
import { useApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import type { Finding } from '@/lib/types';

export function GapDetailPage() {
  const { findingId = '' } = useParams();
  const detail = useApi<{ finding: Finding; guidanceNotice: string }>(`/api/findings/${findingId}`);

  if (detail.loading && !detail.data) return <LoadingBlock rows={5} />;
  if (detail.error || !detail.data) {
    return (
      <ErrorState
        title="Finding not found"
        description={detail.error?.message ?? 'This finding may have been resolved when evidence changed.'}
        onRetry={detail.refetch}
      />
    );
  }

  const { finding, guidanceNotice } = detail.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={finding.title}
        subtitle={`${finding.controlCode} · ${finding.controlName}`}
        breadcrumb={
          <Link to="/app/gaps" className="inline-flex items-center gap-1.5 hover:text-ink-800">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to gap analysis
          </Link>
        }
        meta={
          <>
            <RiskBadge risk={finding.riskLevel} />
            <PriorityBadge priority={finding.priority} />
            <StatusBadge status={finding.controlStatus} />
            <Badge tone="neutral" size="sm">
              {finding.framework}
            </Badge>
            <Badge tone="outline" size="sm">
              {finding.category}
            </Badge>
          </>
        }
        actions={
          <ButtonLink to={`/app/controls/${finding.controlId}`} variant="primary">
            Open control
          </ButtonLink>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Finding" description={`Detected ${formatDateTime(finding.detectedAt)}`} />
            <CardContent className="space-y-4">
              <p className="text-[13.5px] leading-relaxed text-ink-700">{finding.finding}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11.5px] font-medium tracking-wide text-ink-500 uppercase">Evidence found</p>
                  {finding.evidenceFound.length === 0 ? (
                    <p className="mt-1 text-[12.5px] text-ink-500">No supporting documents.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {finding.evidenceFound.map((item) => (
                        <li key={item.evidenceId}>
                          <Link
                            to={`/app/evidence/${item.evidenceId}`}
                            className="inline-flex items-center gap-1.5 text-[12.5px] text-brand-700 hover:text-brand-800"
                          >
                            <FileText className="size-3.5" aria-hidden="true" />
                            {item.fileName}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-[11.5px] font-medium tracking-wide text-danger-700 uppercase">Evidence missing</p>
                  <ul className="mt-1 space-y-1">
                    {finding.evidenceMissing.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[12.5px] text-ink-600">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger-600" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Remediation plan"
              description="Generated guidance — validate against your operating model"
              icon={<Sparkles className="size-4" aria-hidden="true" />}
            />
            <CardContent className="space-y-4">
              <div>
                <p className="text-[11.5px] font-medium tracking-wide text-ink-500 uppercase">Recommended fix</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-700">{finding.recommendation.fix}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[11.5px] tracking-wide text-ink-500 uppercase">
                    <UserRound className="size-3.5" aria-hidden="true" />
                    Suggested owner
                  </p>
                  <p className="mt-1 text-[13.5px] font-medium text-ink-900">{finding.recommendation.owner}</p>
                </div>
                <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[11.5px] tracking-wide text-ink-500 uppercase">
                    <CalendarClock className="size-3.5" aria-hidden="true" />
                    Suggested timeline
                  </p>
                  <p className="mt-1 text-[13.5px] font-medium text-ink-900">{finding.recommendation.timelineLabel}</p>
                </div>
              </div>
              <InlineAlert tone="neutral" title="Why this priority">
                {finding.recommendation.priorityNote}
              </InlineAlert>
              <p className="text-[11.5px] leading-relaxed text-ink-400">{guidanceNotice}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Severity model" />
            <CardContent className="space-y-3">
              <p className="text-[12.5px] leading-relaxed text-ink-600">
                The rating combines the control's inherent risk with the evidence status of this workspace:
              </p>
              <ul className="space-y-2 text-[12.5px] text-ink-600">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger-600" aria-hidden="true" />
                  Missing evidence escalates the control's risk by one level (critical, high or medium control → higher).
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn-600" aria-hidden="true" />
                  Partial evidence keeps the control's inherent risk level.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-400" aria-hidden="true" />
                  Mentioned-but-unverified evidence reduces the level by one.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Remediation checklist" />
            <ol className="divide-y divide-ink-200">
              {[
                'Produce or purchase the missing evidence item(s).',
                `Assign an owner — suggested: ${finding.recommendation.owner}.`,
                `Set a due date — suggested: ${finding.recommendation.timelineLabel}.`,
                'Upload the evidence to the workspace and re-run the analysis.',
                'Confirm the control moves to passed, then re-generate the readiness report.',
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span className="tnum mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-[11px] font-medium text-ink-600">
                    {index + 1}
                  </span>
                  <span className="text-[12.5px] leading-relaxed text-ink-700">{step}</span>
                </li>
              ))}
            </ol>
            <CardContent className="border-t border-ink-200">
              <ButtonLink to="/app/evidence" variant="primary" fullWidth>
                Upload the missing evidence
              </ButtonLink>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
