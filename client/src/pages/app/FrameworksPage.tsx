import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Layers, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, MetricTile } from '@/components/ui/Card';
import { ErrorState, InlineAlert, LoadingBlock, ProgressBar } from '@/components/ui/Feedback';
import { ScoreRing, StackedStatusBar } from '@/components/ui/ScoreRing';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/app/PageHeader';
import { useApi } from '@/lib/api';
import { formatDate, scoreTone } from '@/lib/utils';
import type { FrameworkReadiness } from '@/lib/types';

type ReadinessResponse = {
  items: FrameworkReadiness[];
  workspace: { id: string; name: string; isDemo: boolean };
  disclaimer: string;
};

const CATEGORY_TONE: Record<string, string> = {
  passed: 'bg-pass-600',
  needsAttention: 'bg-warn-600',
  missing: 'bg-danger-600',
  needsReview: 'bg-info-600',
};

export function FrameworksPage() {
  const readiness = useApi<ReadinessResponse>('/api/readiness');
  const [active, setActive] = useState<string>('soc2');
  const items = readiness.data?.items ?? [];
  const frameworks = items.length > 0 ? items : [];
  const selected = frameworks.find((item) => item.key === active) ?? frameworks[0];

  if (readiness.loading && !readiness.data) return <LoadingBlock rows={5} label="Loading framework readiness…" />;
  if (readiness.error) {
    return (
      <ErrorState
        title="Could not load framework readiness"
        description={readiness.error.message}
        onRetry={readiness.refetch}
        offline={readiness.error.code === 'network_error'}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Frameworks"
        subtitle="Readiness assessment against the demo control library for SOC 2 and ISO/IEC 27001. ComplyLens does not perform certifications or issue audit opinions."
        meta={<Badge tone="brand" size="sm">Readiness assessment</Badge>}
        actions={
          <Button
            variant="secondary"
            onClick={readiness.refetch}
            iconLeft={<RefreshCw className={readiness.refreshing ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {frameworks.map((framework) => (
          <Card key={framework.key} className="flex flex-col">
            <CardHeader
              title={`${framework.name} (${framework.version})`}
              description={framework.readinessLabel}
              icon={<Layers className="size-4" aria-hidden="true" />}
              actions={
                <Badge tone={framework.status === 'ready-for-demo' ? 'pass' : 'warn'} size="sm">
                  {framework.status === 'ready-for-demo' ? 'Ready for demo' : 'Awaiting evidence'}
                </Badge>
              }
            />
            <CardContent className="flex flex-1 flex-col gap-5">
              <div className="flex items-center gap-5">
                <ScoreRing value={framework.readinessIndex} size={112} stroke={9} label={framework.readinessLabel} />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <p className={`text-[13.5px] font-medium ${scoreTone(framework.readinessIndex).text}`}>{framework.bandLabel}</p>
                  <p className="text-[12.5px] leading-relaxed text-ink-600">{framework.intent}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="neutral" size="sm">
                      {framework.controls} controls
                    </Badge>
                    <Badge tone="neutral" size="sm">
                      {framework.categories.length} categories
                    </Badge>
                    <Badge tone="outline" size="sm">
                      {framework.findings} findings
                    </Badge>
                  </div>
                </div>
              </div>

              <StackedStatusBar
                passed={framework.counts.passed}
                needsAttention={framework.counts.needsAttention}
                missing={framework.counts.missing}
                needsReview={framework.counts.needsReview}
              />

              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11.5px] tracking-wide text-ink-500 uppercase">Documents</dt>
                  <dd className="tnum mt-0.5 text-[15px] font-semibold text-ink-900">{framework.coverage.documents}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] tracking-wide text-ink-500 uppercase">Controls covered</dt>
                  <dd className="tnum mt-0.5 text-[15px] font-semibold text-ink-900">
                    {framework.coverage.distinctControlsCovered}
                  </dd>
                </div>
              </dl>

              <div className="mt-auto flex flex-wrap gap-2">
                <ButtonLink
                  to={`/app/controls?framework=${framework.key}`}
                  variant="secondary"
                  size="sm"
                  iconRight={<ArrowRight className="size-3.5" aria-hidden="true" />}
                >
                  Open control library
                </ButtonLink>
                <ButtonLink to={`/app/reports`} variant="ghost" size="sm">
                  Generate report
                </ButtonLink>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="SOC 2 controls" value={frameworks.find((item) => item.key === 'soc2')?.controls ?? '—'} hint="Demo control library" />
        <MetricTile label="ISO 27001 controls" value={frameworks.find((item) => item.key === 'iso27001')?.controls ?? '—'} hint="Demo control library" />
        <MetricTile
          label="Controls covered by evidence"
          value={frameworks[0]?.coverage.distinctControlsCovered ?? '—'}
          hint="Distinct controls mapped to at least one document"
        />
        <MetricTile
          label="Unmapped documents"
          value={frameworks[0]?.coverage.unmappedDocuments.length ?? 0}
          hint="Uploaded files that do not map to a control"
        />
      </div>

      {selected ? (
        <Card>
          <CardHeader
            title={`${selected.shortName} category coverage`}
            description="Control status by category across the demo library"
          />
          <CardContent>
            <Tabs
              ariaLabel="Framework"
              items={frameworks.map((framework) => ({
                id: framework.key,
                label: framework.shortName,
                badge: <span className="tnum text-[11px] text-ink-400">{framework.controls}</span>,
              }))}
              active={selected.key}
              onChange={setActive}
            />
            <TabPanel id={selected.key} active={selected.key} className="mt-4">
              <ul className="divide-y divide-ink-100">
                {selected.categories.map((category) => {
                  const segments = [
                    { key: 'passed', value: category.passed, label: 'Passed' },
                    { key: 'needsAttention', value: category.needsAttention, label: 'Needs attention' },
                    { key: 'missing', value: category.missing, label: 'Missing' },
                    { key: 'needsReview', value: category.needsReview, label: 'Needs review' },
                  ].filter((segment) => segment.value > 0);
                  return (
                    <li key={category.category} className="py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[13px] font-medium text-ink-800">{category.category}</p>
                        <span className="tnum text-[12px] text-ink-500">
                          {category.passed}/{category.controls} passed
                        </span>
                      </div>
                      <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-ink-100">
                        {segments.map((segment) => (
                          <span
                            key={segment.key}
                            className={CATEGORY_TONE[segment.key]}
                            style={{ width: `${(segment.value / Math.max(1, category.controls)) * 100}%` }}
                            title={`${segment.label}: ${segment.value}`}
                          />
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11.5px] text-ink-500">
                        {segments.map((segment) => `${segment.label} ${segment.value}`).join(' · ')}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </TabPanel>
          </CardContent>
        </Card>
      ) : null}

      {selected ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Score components" description={selected.methodology} />
            <CardContent className="space-y-3.5">
              {selected.components.map((component) => (
                <div key={component.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12.5px] text-ink-700">{component.label}</span>
                    <span className="tnum text-[12.5px] font-medium text-ink-800">
                      {Math.round(component.value * 100)}%
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={component.value} size="sm" tone="ink" label={component.label} />
                  </div>
                  <p className="mt-1 text-[11.5px] text-ink-500">
                    {component.description} · weight {Math.round(component.weight * 100)}%
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Coverage details" description={`Workspace: ${readiness.data?.workspace.name ?? '—'}`} />
            <CardContent className="space-y-4">
              <dl className="space-y-2.5 text-[12.5px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-500">Documents in workspace</dt>
                  <dd className="tnum font-medium text-ink-800">{selected.coverage.documents}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-500">Documents mapped to controls</dt>
                  <dd className="tnum font-medium text-ink-800">{selected.coverage.documentsMapped}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-500">Distinct controls covered</dt>
                  <dd className="tnum font-medium text-ink-800">{selected.coverage.distinctControlsCovered}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-500">Reviewed controls</dt>
                  <dd className="tnum font-medium text-ink-800">
                    {selected.counts.reviewed} of {selected.counts.total}
                  </dd>
                </div>
              </dl>

              {selected.coverage.unmappedDocuments.length > 0 ? (
                <InlineAlert tone="warn" title="Documents without a control match">
                  <ul className="mt-1 space-y-1">
                    {selected.coverage.unmappedDocuments.map((fileName) => (
                      <li key={fileName} className="text-[12.5px]">
                        {fileName}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[12px]">
                    These files are stored and searchable but do not currently evidence a control. Review them in the{' '}
                    <Link to="/app/mappings" className="font-medium underline">
                      evidence-to-control mapping
                    </Link>{' '}
                    view.
                  </p>
                </InlineAlert>
              ) : (
                <InlineAlert tone="pass" title="Every document maps to at least one control">
                  Coverage is complete for this framework in the demo workspace.
                </InlineAlert>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <InlineAlert tone="neutral" title="About framework support">
        {readiness.data?.disclaimer ??
          'Framework support in this build is a readiness assessment against a demo control library. ComplyLens does not perform certifications or issue audit opinions.'}
        <p className="mt-1.5 text-[12px] text-ink-500">Snapshot generated {formatDate(new Date())} from the current workspace evidence.</p>
      </InlineAlert>
    </div>
  );
}
