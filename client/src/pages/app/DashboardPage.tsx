import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  FileText,
  GitCompareArrows,
  RefreshCw,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { Badge, DemoDataBadge, EvidenceStatusBadge, PriorityBadge, RiskBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, MetricTile } from '@/components/ui/Card';
import { EmptyState, ErrorState, InlineAlert, LoadingBlock } from '@/components/ui/Feedback';
import { ScoreRing, StackedStatusBar } from '@/components/ui/ScoreRing';
import { Tooltip } from '@/components/ui/Dropdown';
import { PageHeader } from '@/components/app/PageHeader';
import { useApi } from '@/lib/api';
import { useSession } from '@/lib/session';
import { cn, formatDate, relativeTime } from '@/lib/utils';
import type { DashboardData, Finding } from '@/lib/types';

export function DashboardPage() {
  const navigate = useNavigate();
  const { context } = useSession();
  const [showMethod, setShowMethod] = useState(false);
  const dashboard = useApi<DashboardData>('/api/dashboard');

  if (dashboard.loading && !dashboard.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Loading your workspace…"
          subtitle="Reading evidence, mapping controls and calculating the readiness index."
        />
        <LoadingBlock rows={4} />
      </div>
    );
  }

  if (dashboard.error || !dashboard.data) {
    return (
      <ErrorState
        title="We could not load the dashboard"
        description={dashboard.error?.message}
        onRetry={dashboard.refetch}
        offline={dashboard.error?.code === 'network_error'}
      />
    );
  }

  const data = dashboard.data;
  const hasEvidence = data.coverage.total > 0;
  const isDemo = context?.workspace.isDemo ?? data.workspace.isDemo;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data.greeting.label}, ${data.greeting.name}`}
        subtitle="Here’s your compliance readiness overview."
        meta={
          <>
            <Badge tone="outline" size="sm">
              {data.framework.shortName}
            </Badge>
            <Badge tone={data.analysisMode.key === 'external-ai' ? 'brand' : 'neutral'} size="sm">
              <Sparkles className="size-3" aria-hidden="true" />
              {data.analysisMode.key === 'external-ai' ? 'AI-assisted analysis' : 'Demo Analysis Mode'}
            </Badge>
            {isDemo ? <DemoDataBadge /> : null}
            <span className="text-[12px] text-ink-500">Updated {relativeTime(data.generatedAt)}</span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              iconLeft={<RefreshCw className={cn('size-4', dashboard.refreshing && 'animate-spin')} aria-hidden="true" />}
              onClick={dashboard.refetch}
              aria-label="Refresh dashboard"
            >
              Refresh
            </Button>
            <ButtonLink
              to="/app/evidence"
              variant="primary"
              size="md"
              iconLeft={<Upload className="size-4" aria-hidden="true" />}
            >
              Upload evidence
            </ButtonLink>
          </>
        }
      />

      {!hasEvidence ? (
        <EmptyState
          title="No evidence in this workspace yet"
          description="Upload your policies, procedures and records — or load the labelled sample document set — to run the first readiness assessment. Nothing is scored until evidence exists."
          icon={<Upload className="size-5" aria-hidden="true" />}
          action={
            <ButtonLink to="/app/evidence" variant="primary" iconLeft={<Upload className="size-4" />}>
              Upload evidence
            </ButtonLink>
          }
          secondaryAction={
            <ButtonLink to="/app/help" variant="secondary">
              How the analysis works
            </ButtonLink>
          }
        />
      ) : null}

      {/* Metric row */}
      <section aria-label="Readiness metrics" className="grid gap-4 lg:grid-cols-[minmax(260px,1.1fr)_2fr]">
        <Card className="flex items-center gap-5 p-5">
          <ScoreRing value={data.metric.readinessIndex} size={132} stroke={10} sublabel={data.metric.bandLabel} />
          <div className="min-w-0">
            <p className="text-[12px] font-medium tracking-wide text-ink-500 uppercase">Readiness score</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
              Weighted index across {data.counts.reviewed} reviewed controls.
            </p>
            <button
              type="button"
              onClick={() => setShowMethod((value) => !value)}
              aria-expanded={showMethod}
              className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-700 hover:text-brand-800"
            >
              {showMethod ? 'Hide' : 'How is this calculated?'}
              <ChevronDown className={cn('size-3.5 transition-transform', showMethod && 'rotate-180')} aria-hidden="true" />
            </button>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Controls reviewed"
            value={data.counts.reviewed}
            hint={`${data.counts.total - data.counts.needsReview} in scope · ${data.counts.needsReview} awaiting review`}
            icon={<BarChart3 className="size-4" aria-hidden="true" />}
          />
          <MetricTile
            label="Passed"
            value={data.counts.passed}
            hint="Fully evidenced controls"
            tone="text-pass-700"
            icon={<GitCompareArrows className="size-4" aria-hidden="true" />}
          />
          <MetricTile
            label="Needs attention"
            value={data.counts.needsAttention}
            hint="Partial evidence"
            tone="text-warn-700"
            icon={<TriangleAlert className="size-4" aria-hidden="true" />}
          />
          <MetricTile
            label="Critical gaps"
            value={data.counts.missing}
            hint="No supporting evidence"
            tone="text-danger-700"
            icon={<TriangleAlert className="size-4" aria-hidden="true" />}
          />
        </div>
      </section>

      {showMethod ? (
        <Card>
          <CardHeader
            title="Readiness index breakdown"
            description={data.metric.methodology}
            icon={<Sparkles className="size-4" aria-hidden="true" />}
          />
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.metric.components.map((component) => (
              <div key={component.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[13px] font-medium text-ink-700">{component.label}</p>
                  <p className="tnum text-[13px] font-semibold text-ink-900">{Math.round(component.value * 100)}%</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${Math.round(component.value * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
                  Weight {Math.round(component.weight * 100)}% · {component.description}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          {/* Readiness overview */}
          <Card>
            <CardHeader
              title="Readiness overview"
              description="Status per framework in this workspace"
              icon={<TrendingUp className="size-4" aria-hidden="true" />}
              actions={
                <ButtonLink to="/app/frameworks" variant="ghost" size="sm" iconRight={<ArrowRight className="size-3.5" />}>
                  Frameworks
                </ButtonLink>
              }
            />
            <CardContent className="space-y-5">
              {data.frameworks.map((framework) => (
                <div key={framework.key}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium text-ink-900">{framework.shortName}</span>
                      <Badge tone="outline" size="sm">
                        {framework.readinessLabel}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tnum text-[15px] font-semibold text-ink-900">{framework.readinessIndex}%</span>
                      <span className="text-[12px] text-ink-500">{framework.bandLabel}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <StackedStatusBar
                      passed={framework.counts.passed}
                      needsAttention={framework.counts.needsAttention}
                      missing={framework.counts.missing}
                      needsReview={framework.counts.needsReview}
                      showLegend={false}
                    />
                  </div>
                  <p className="mt-2 text-[12px] text-ink-500">
                    {framework.counts.reviewed} of {framework.counts.total} controls reviewed ·{' '}
                    {framework.counts.passed} passed · {framework.counts.needsAttention} partial ·{' '}
                    {framework.counts.missing} missing
                  </p>
                </div>
              ))}
              <StackedStatusBar
                passed={data.counts.passed}
                needsAttention={data.counts.needsAttention}
                missing={data.counts.missing}
                needsReview={data.counts.needsReview}
              />
            </CardContent>
          </Card>

          {/* Priority findings */}
          <Card>
            <CardHeader
              title="Priority findings"
              description={`${data.findings.total} open findings across both frameworks`}
              icon={<TriangleAlert className="size-4" aria-hidden="true" />}
              actions={
                <ButtonLink to="/app/gaps" variant="ghost" size="sm" iconRight={<ArrowRight className="size-3.5" />}>
                  Gap analysis
                </ButtonLink>
              }
            />
            <ul className="divide-y divide-ink-200">
              {data.priorityFindings.map((finding) => (
                <FindingRow key={finding.id} finding={finding} onOpen={() => navigate(`/app/gaps/${finding.id}`)} />
              ))}
            </ul>
            <div className="border-t border-ink-200 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-500">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-danger-600" /> {data.findings.critical} critical
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-warn-600" /> {data.findings.high} high
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-info-600" /> {data.findings.medium} medium
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-pass-600" /> {data.findings.low} low
                </span>
              </div>
            </div>
          </Card>

          {/* Category coverage */}
          <Card>
            <CardHeader
              title="Coverage by category"
              description={`${data.coverage.distinctControlsCovered} controls currently mapped to evidence`}
              icon={<BarChart3 className="size-4" aria-hidden="true" />}
            />
            <CardContent className="space-y-3">
              {data.categories.slice(0, 8).map((category) => (
                <div key={category.category} className="grid grid-cols-[minmax(120px,1.2fr)_2.4fr_auto] items-center gap-3">
                  <span className="truncate text-[12.5px] text-ink-700">{category.category}</span>
                  <div className="flex h-2 overflow-hidden rounded-full bg-ink-100">
                    <span
                      className="bg-pass-600"
                      style={{ width: `${(category.passed / Math.max(1, category.total)) * 100}%` }}
                    />
                    <span
                      className="bg-warn-600"
                      style={{ width: `${(category.needsAttention / Math.max(1, category.total)) * 100}%` }}
                    />
                    <span
                      className="bg-danger-600"
                      style={{ width: `${(category.missing / Math.max(1, category.total)) * 100}%` }}
                    />
                    <span
                      className="bg-ink-300"
                      style={{ width: `${(category.needsReview / Math.max(1, category.total)) * 100}%` }}
                    />
                  </div>
                  <span className="tnum text-[12px] text-ink-500">
                    {category.passed}/{category.total}
                  </span>
                </div>
              ))}
              {data.categories.length === 0 ? (
                <p className="text-[13px] text-ink-500">No categories to show yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Recent evidence */}
          <Card>
            <CardHeader
              title="Recent evidence"
              description={`${data.coverage.total} documents · ${data.coverage.analyzed} analyzed`}
              icon={<FileText className="size-4" aria-hidden="true" />}
              actions={
                <ButtonLink to="/app/evidence" variant="ghost" size="sm" iconRight={<ArrowRight className="size-3.5" />}>
                  All evidence
                </ButtonLink>
              }
            />
            <ul className="divide-y divide-ink-200">
              {data.recentEvidence.map((document) => (
                <li key={document.id}>
                  <Link
                    to={`/app/evidence/${document.id}`}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink-50 sm:px-5"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-500">
                      <FileText className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink-900">{document.fileName}</span>
                      <span className="mt-0.5 block text-[12px] text-ink-500">
                        {document.category} · {document.sizeLabel} · {relativeTime(document.uploadedAt)}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <EvidenceStatusBadge status={document.status} size="sm" />
                        {document.mappedControlCount > 0 ? (
                          <Badge tone="outline" size="sm">
                            {document.mappedControlCount} controls
                          </Badge>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {data.recentEvidence.length === 0 ? (
                <li className="px-4 py-6 text-center text-[13px] text-ink-500">No evidence uploaded yet.</li>
              ) : null}
            </ul>
          </Card>

          {data.coverage.failed > 0 || data.coverage.needsReview > 0 ? (
            <InlineAlert tone="warn" title="Documents needing attention">
              {data.coverage.failed > 0
                ? `${data.coverage.failed} document could not be analysed (no extractable text). `
                : ''}
              {data.coverage.needsReview > 0
                ? `${data.coverage.needsReview} document is flagged for manual review — it never closes a control until it is verified.`
                : ''}
            </InlineAlert>
          ) : null}

          {/* Evidence → control mapping: the chain the whole product is built on */}
          <Card>
            <CardHeader
              title="Evidence-to-control mapping"
              description={`${data.coverage.distinctControlsCovered} controls supported by workspace evidence`}
              icon={<GitCompareArrows className="size-4" aria-hidden="true" />}
              actions={
                <ButtonLink to="/app/mappings" variant="ghost" size="sm" iconRight={<ArrowRight className="size-3.5" />}>
                  Full mapping
                </ButtonLink>
              }
            />
            <ul className="divide-y divide-ink-200">
              {data.recentEvidence.slice(0, 4).map((document) => (
                <li key={document.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-600">
                    {document.fileName}
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                  <span className="shrink-0 text-[12px] text-ink-800">
                    {document.mappedControlCount} {document.mappedControlCount === 1 ? 'control' : 'controls'}
                  </span>
                </li>
              ))}
            </ul>
            {data.coverage.unmappedDocuments.length > 0 ? (
              <p className="border-t border-ink-200 px-4 py-3 text-[12px] leading-relaxed text-ink-500 sm:px-5">
                Not mapped yet: {data.coverage.unmappedDocuments.join(', ')}. Documents only count towards a control when
                an expected evidence item is actually present in the text.
              </p>
            ) : null}
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader title="Recent activity" icon={<RefreshCw className="size-4" aria-hidden="true" />} />
            <ol className="divide-y divide-ink-200">
              {data.activity.items.slice(0, 6).map((item) => (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span
                    className={cn(
                      'mt-1.5 size-1.5 shrink-0 rounded-full',
                      item.type === 'error' ? 'bg-danger-600' : 'bg-brand-500',
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] text-ink-800">{item.label}</span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-500">
                      {formatDate(item.at)} · {item.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Next best actions" icon={<Sparkles className="size-4" aria-hidden="true" />} />
            <CardContent className="space-y-3">
              {[
                {
                  to: '/app/gaps',
                  label: `Close ${data.findings.critical + data.findings.high} critical and high findings`,
                  detail: 'Open the gap analysis and work the remediation list in priority order.',
                },
                {
                  to: '/app/mappings',
                  label: 'Review evidence-to-control mapping',
                  detail: 'Confirm that documents are supporting the controls you expect.',
                },
                {
                  to: '/app/reports',
                  label: 'Generate a readiness report',
                  detail: 'Produce a PDF snapshot of the current readiness state for stakeholders.',
                },
              ].map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="flex items-start gap-3 rounded-lg border border-ink-200 px-3.5 py-3 transition-colors hover:border-ink-300 hover:bg-ink-50"
                >
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
                  <span>
                    <span className="block text-[13px] font-medium text-ink-900">{action.label}</span>
                    <span className="mt-0.5 block text-[12px] text-ink-500">{action.detail}</span>
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FindingRow({ finding, onOpen }: { finding: Finding; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink-50 sm:px-5"
      >
        <span className="mt-0.5">
          <RiskBadge risk={finding.riskLevel} size="sm" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-ink-900">{finding.title}</span>
          <span className="mt-1 block font-mono text-[11.5px] text-ink-500">
            {finding.controlCode} · {finding.controlName} · {finding.category}
          </span>
          <span className="mt-1.5 block text-[12px] text-ink-500">
            Suggested owner: <span className="text-ink-700">{finding.recommendation.owner}</span> ·{' '}
            {finding.recommendation.timelineLabel}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <PriorityBadge priority={finding.priority} />
          <Tooltip label={finding.recommendation.priorityNote}>
            <span className="text-[11px] text-ink-400">why?</span>
          </Tooltip>
        </span>
      </button>
    </li>
  );
}
