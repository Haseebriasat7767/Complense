import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, GitCompareArrows, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Badge, RiskBadge, StatusBadge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, MetricTile } from '@/components/ui/Card';
import { EmptyState, ErrorState, InlineAlert, LoadingBlock } from '@/components/ui/Feedback';
import { ProgressBar } from '@/components/ui/Feedback';
import { SegmentedControl } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/app/PageHeader';
import { useApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { FrameworkKey, MappingsResponse } from '@/lib/types';

export function MappingsPage() {
  const [framework, setFramework] = useState<'all' | FrameworkKey>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const mappings = useApi<MappingsResponse>(
    `/api/mappings${framework === 'all' ? '' : `?framework=${framework}`}`,
  );

  if (mappings.loading && !mappings.data) return <LoadingBlock rows={5} />;
  if (mappings.error || !mappings.data) {
    return (
      <ErrorState
        title="Could not load the mapping view"
        description={mappings.error?.message}
        onRetry={mappings.refetch}
      />
    );
  }

  const { documents, controls, findings, summary, disclaimer } = mappings.data;
  const controlsWithEvidence = controls.filter((control) => control.evidenceCount > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence mapping"
        subtitle="Which documents support which controls — and where the evidence falls short."
        meta={
          <>
            <Badge tone="outline" size="sm">
              {summary.documents} documents
            </Badge>
            <Badge tone="outline" size="sm">
              {summary.controlsCovered} controls covered
            </Badge>
            <Badge tone="danger" size="sm">
              {summary.findings} findings
            </Badge>
          </>
        }
        actions={
          <SegmentedControl
            ariaLabel="Framework"
            value={framework}
            onChange={setFramework}
            options={[
              { value: 'all', label: 'Both' },
              { value: 'soc2', label: 'SOC 2' },
              { value: 'iso27001', label: 'ISO 27001' },
            ]}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Documents analysed" value={`${summary.mappedDocuments}/${summary.documents}`} hint="At least one control mapped" />
        <MetricTile label="Controls covered" value={summary.controlsCovered} hint="Supported by at least one document" />
        <MetricTile label="Findings raised" value={summary.findings} hint="Controls that are not fully evidenced" tone="text-danger-700" />
        <MetricTile
          label="Unmapped documents"
          value={summary.unmappedDocuments.length}
          hint="No required evidence items matched"
          tone={summary.unmappedDocuments.length > 0 ? 'text-warn-700' : undefined}
        />
      </div>

      {summary.unmappedDocuments.length > 0 ? (
        <InlineAlert tone="warn" title="Documents without mappings" icon={<TriangleAlert className="size-4" aria-hidden="true" />}>
          {summary.unmappedDocuments.join(', ')} did not match any required evidence item. This can happen when a document
          is scanned without a text layer, when the wrong category was selected, or when it genuinely does not address a
          control requirement.
        </InlineAlert>
      ) : null}

      {documents.length === 0 ? (
        <EmptyState
          title="No evidence to map yet"
          description="Upload evidence documents and ComplyLens will show which controls each one supports."
          icon={<GitCompareArrows className="size-5" aria-hidden="true" />}
          action={
            <ButtonLink to="/app/evidence" variant="primary">
              Upload evidence
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader
              title="Evidence → Controls"
              description="Expand a document to see the controls it supports and the items it still misses."
              icon={<FileText className="size-4" aria-hidden="true" />}
            />
            <ul className="divide-y divide-ink-200">
              {documents.map((document) => {
                const isOpen = expanded === document.id;
                return (
                  <li key={document.id}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : document.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink-50 sm:px-5"
                    >
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-500">
                        <FileText className="size-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink-900">{document.fileName}</span>
                        <span className="mt-0.5 block text-[12px] text-ink-500">
                          {document.category} · {document.mappedControls} control
                          {document.mappedControls === 1 ? '' : 's'} mapped
                        </span>
                      </span>
                      <ArrowRight
                        className={cn('mt-1 size-4 shrink-0 text-ink-300 transition-transform', isOpen && 'rotate-90')}
                        aria-hidden="true"
                      />
                    </button>

                    {isOpen ? (
                      <div className="animate-fade border-t border-ink-200 bg-ink-50/50 px-4 py-3 sm:px-5">
                        {document.controls.length === 0 ? (
                          <p className="text-[12.5px] text-ink-500">
                            No control matched this document. {document.status === 'failed' ? 'Text extraction failed, so it could not be analysed.' : 'Check the category or upload a more specific document.'}
                          </p>
                        ) : (
                          <ul className="space-y-3">
                            {document.controls.map((control) => (
                              <li key={control.controlId} className="rounded-lg border border-ink-200 bg-white px-3.5 py-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <Link to={`/app/controls/${control.controlId}`} className="group min-w-0">
                                    <span className="font-mono text-[11px] text-ink-500">{control.controlCode}</span>
                                    <span className="mt-0.5 block text-[13px] font-medium text-ink-900 group-hover:text-brand-700">
                                      {control.controlName}
                                    </span>
                                  </Link>
                                  <Badge tone="outline" size="sm">
                                    {Math.round(control.confidence * 100)}%
                                  </Badge>
                                </div>
                                <div className="mt-2">
                                  <ProgressBar value={control.confidence} size="sm" label="Mapping confidence" />
                                </div>
                                <div className="mt-2.5 grid gap-2 text-[12px] sm:grid-cols-2">
                                  <div>
                                    <p className="font-medium text-pass-700">Supports</p>
                                    <p className="text-ink-600">{control.matchedItems.join('; ') || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="font-medium text-danger-700">Still missing</p>
                                    <p className="text-ink-600">{control.missingItems.join('; ') || 'Nothing'}</p>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Controls with evidence"
                description={`${controlsWithEvidence.length} of ${controls.length} controls have at least one supporting document`}
                icon={<ShieldCheck className="size-4" aria-hidden="true" />}
              />
              <ul className="max-h-[560px] divide-y divide-ink-200 overflow-y-auto scroll-area">
                {controlsWithEvidence.map((control) => (
                  <li key={control.controlId} className="px-4 py-3 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/app/controls/${control.controlId}`} className="min-w-0 group">
                        <span className="font-mono text-[11px] text-ink-500">{control.controlCode}</span>
                        <span className="mt-0.5 block truncate text-[12.5px] font-medium text-ink-900 group-hover:text-brand-700">
                          {control.controlName}
                        </span>
                      </Link>
                      <StatusBadge status={control.status} label={control.statusLabel} size="sm" />
                    </div>
                    <p className="mt-1.5 text-[11.5px] text-ink-500">
                      {control.evidenceCount} document{control.evidenceCount === 1 ? '' : 's'} ·{' '}
                      {control.missingItems.length > 0 ? `missing ${control.missingItems.join('; ')}` : 'all required items found'}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardHeader
                title="Findings from the mapping"
                description="Controls that are not fully evidenced"
                icon={<TriangleAlert className="size-4" aria-hidden="true" />}
              />
              <ul className="divide-y divide-ink-200">
                {findings.slice(0, 8).map((finding) => (
                  <li key={finding.id}>
                    <Link
                      to={`/app/gaps/${finding.id}`}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink-50 sm:px-5"
                    >
                      <RiskBadge risk={finding.riskLevel} size="sm" />
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium text-ink-900">{finding.title}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-ink-500">{finding.controlCode}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <CardContent className="border-t border-ink-200">
                <p className="text-[11.5px] leading-relaxed text-ink-500">{disclaimer}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
