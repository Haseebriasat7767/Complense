import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed, FileText, Sparkles, XCircle } from 'lucide-react';
import { Badge, RiskBadge, StatusBadge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ErrorState, InlineAlert, LoadingBlock, ProgressBar } from '@/components/ui/Feedback';
import { Tooltip } from '@/components/ui/Dropdown';
import { PageHeader } from '@/components/app/PageHeader';
import { useApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import type { ControlDetail } from '@/lib/types';

export function ControlDetailPage() {
  const { controlId = '' } = useParams();
  const detail = useApi<ControlDetail>(`/api/controls/${controlId}`);

  if (detail.loading && !detail.data) return <LoadingBlock rows={6} />;
  if (detail.error || !detail.data) {
    return (
      <ErrorState
        title="Control not found"
        description={detail.error?.message ?? 'This control is not part of the library for the selected framework.'}
        onRetry={detail.refetch}
      />
    );
  }

  const { control, requirements, evidenceFound, evidenceMissing, analysis, finding, recommendation, relatedControls, disclaimer } =
    detail.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={control.name}
        subtitle={control.description}
        breadcrumb={
          <Link to="/app/controls" className="inline-flex items-center gap-1.5 hover:text-ink-800">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to controls
          </Link>
        }
        meta={
          <>
            <span className="rounded-md border border-ink-200 bg-white px-2 py-1 font-mono text-[11.5px] text-ink-700">
              {control.code}
            </span>
            <Badge tone="neutral" size="sm">
              {control.framework}
            </Badge>
            <Badge tone="outline" size="sm">
              {control.category}
            </Badge>
            <RiskBadge risk={control.riskLevel} />
            <StatusBadge status={control.status} label={control.statusLabel} />
          </>
        }
        actions={
          finding ? (
            <ButtonLink
              to={`/app/gaps/${finding.id}`}
              variant="primary"
              iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
            >
              Open finding
            </ButtonLink>
          ) : (
            <ButtonLink to="/app/gaps" variant="secondary">
              Gap analysis
            </ButtonLink>
          )
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Evidence found"
              description={`${evidenceFound.length} document${evidenceFound.length === 1 ? '' : 's'} support this control`}
              icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
            />
            {evidenceFound.length === 0 ? (
              <div className="px-4 py-6 sm:px-5">
                <InlineAlert tone="danger" title="No supporting evidence">
                  Nothing in the workspace satisfies the required evidence items for this control. It will be raised as a
                  finding and treated as unmitigated until evidence is uploaded.
                </InlineAlert>
              </div>
            ) : (
              <ul className="divide-y divide-ink-200">
                {evidenceFound.map((document) => (
                  <li key={document.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                    <FileText className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/app/evidence/${document.id}`}
                        className="block truncate text-[13px] font-medium text-ink-900 hover:text-brand-700"
                      >
                        {document.fileName}
                      </Link>
                      <p className="mt-1 text-[12px] text-ink-500">{document.summary}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone="outline" size="sm">
                          {document.category}
                        </Badge>
                        <Badge tone="neutral" size="sm">
                          {document.sizeLabel}
                        </Badge>
                      </div>
                    </div>
                    <ButtonLink to={`/app/evidence/${document.id}`} size="sm" variant="ghost">
                      Open
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Required evidence" description="What this control expects to see in the workspace" />
            <ul className="divide-y divide-ink-200">
              {requirements.map((requirement) => (
                <li key={requirement.label} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  {requirement.satisfied ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pass-600" aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-danger-600" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink-800">{requirement.label}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-500">
                      {requirement.satisfied ? 'Supported by uploaded evidence' : 'No matching evidence found'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Analysis" description="Deterministic mapping — the same evidence always produces this result" />
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[12px] tracking-wide text-ink-500 uppercase">Mapping confidence</p>
                  <p className="tnum mt-1 text-xl font-semibold text-ink-900">
                    {Math.round(analysis.confidence * 100)}%
                  </p>
                  <div className="mt-2">
                    <ProgressBar
                      value={analysis.confidence}
                      tone={analysis.confidence >= 0.75 ? 'pass' : analysis.confidence >= 0.3 ? 'warn' : 'danger'}
                      label={`Confidence ${Math.round(analysis.confidence * 100)}%`}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[12px] tracking-wide text-ink-500 uppercase">Evidence depth</p>
                  <p className="tnum mt-1 text-xl font-semibold text-ink-900">
                    {requirements.filter((item) => item.satisfied).length}/{requirements.length}
                  </p>
                  <p className="mt-2 text-[12px] text-ink-500">Required evidence items satisfied</p>
                </div>
              </div>
              <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-3.5 py-3">
                <p className="text-[12.5px] leading-relaxed text-ink-600">{control.analysisNote}</p>
              </div>
              <p className="text-[11.5px] text-ink-400">Last assessed {formatDateTime(control.updatedAt)}</p>
            </CardContent>
          </Card>

          {evidenceMissing.length > 0 ? (
            <Card>
              <CardHeader
                title="Evidence missing"
                description="Upload or document these items to move this control forward"
                icon={<CircleDashed className="size-4" aria-hidden="true" />}
              />
              <ul className="divide-y divide-ink-200">
                {evidenceMissing.map((item) => (
                  <li key={item} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span className="size-1.5 rounded-full bg-danger-600" aria-hidden="true" />
                    <span className="text-[13px] text-ink-700">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          {finding ? (
            <Card>
              <CardHeader
                title="Finding"
                description="Raised automatically because this control is not fully evidenced"
                actions={<RiskBadge risk={finding.riskLevel} size="sm" />}
              />
              <CardContent className="space-y-4">
                <div>
                  <p className="text-[13.5px] font-medium text-ink-900">{finding.title}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{finding.finding}</p>
                </div>
                <dl className="grid grid-cols-2 gap-3 border-t border-ink-200 pt-3">
                  <div>
                    <dt className="text-[11.5px] tracking-wide text-ink-500 uppercase">Priority</dt>
                    <dd className="tnum mt-0.5 text-[13px] font-medium text-ink-900">{finding.priority}</dd>
                  </div>
                  <div>
                    <dt className="text-[11.5px] tracking-wide text-ink-500 uppercase">Status</dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-ink-900 capitalize">{finding.status}</dd>
                  </div>
                </dl>
                <ButtonLink to={`/app/gaps/${finding.id}`} variant="primary" fullWidth>
                  Open remediation plan
                </ButtonLink>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader title="No finding" />
              <CardContent>
                <InlineAlert tone="pass" title="Fully evidenced">
                  All required evidence items are supported, so no finding was raised for this control.
                </InlineAlert>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Recommended action"
              description="Generated guidance from the ComplyLens analysis layer"
              icon={<Sparkles className="size-4" aria-hidden="true" />}
            />
            <CardContent className="space-y-4">
              <p className="text-[13.5px] leading-relaxed text-ink-700">
                {finding ? finding.recommendation.fix : recommendation.fix}
              </p>
              <dl className="grid grid-cols-2 gap-3 border-t border-ink-200 pt-3">
                <div>
                  <dt className="text-[11.5px] tracking-wide text-ink-500 uppercase">Suggested owner</dt>
                  <dd className="mt-0.5 text-[13px] text-ink-800">{recommendation.owner}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] tracking-wide text-ink-500 uppercase">Suggested timeline</dt>
                  <dd className="mt-0.5 text-[13px] text-ink-800">{recommendation.timelineDays} days</dd>
                </div>
              </dl>
              <p className="text-[11.5px] leading-relaxed text-ink-400">
                Guidance is generated by the rule set in the control library. Validate the owner and timeline against your
                operating model — it is not an audit conclusion.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Why this control matters" />
            <CardContent>
              <p className="text-[13px] leading-relaxed text-ink-600">{control.rationale}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="neutral" size="sm">
                  {control.frameworkVersion}
                </Badge>
                {control.isPolicyDomain ? (
                  <Badge tone="outline" size="sm">
                    Policy domain
                  </Badge>
                ) : (
                  <Badge tone="outline" size="sm">
                    Operational evidence expected
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {relatedControls.length > 0 ? (
            <Card>
              <CardHeader title={`Other controls in ${control.category}`} />
              <ul className="divide-y divide-ink-200">
                {relatedControls.map((related) => (
                  <li key={related.id}>
                    <Link
                      to={`/app/controls/${related.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-ink-50 sm:px-5"
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-[11px] text-ink-500">{related.code}</span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-ink-800">{related.name}</span>
                      </span>
                      <StatusBadge status={related.status} label={related.statusLabel} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Tooltip label={disclaimer}>
            <p className="cursor-help text-[11.5px] text-ink-400">Readiness assessment only — not an audit conclusion.</p>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
