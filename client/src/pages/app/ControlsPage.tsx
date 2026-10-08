import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, LayoutList, ShieldCheck } from 'lucide-react';
import { Badge, RiskBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { SearchInput, Select } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/Tabs';
import { PageHeader } from '@/components/app/PageHeader';
import { useApi, useDebounced } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ControlListItem, ControlStatus, FrameworkKey, RiskLevel } from '@/lib/types';

type ControlsResponse = {
  items: ControlListItem[];
  total: number;
  filters: {
    frameworks: FrameworkKey[];
    statuses: Array<{ value: ControlStatus; label: string }>;
    risks: Array<{ value: RiskLevel; label: string }>;
    categories: Array<{ category: string; count: number }>;
  };
  summary: Array<{
    key: FrameworkKey;
    name: string;
    counts: { total: number; reviewed: number; passed: number; needsAttention: number; missing: number; needsReview: number };
    readinessIndex: number;
    categories: Array<{ category: string; count: number }>;
  }>;
  disclaimer: string;
};

const STATUS_FILTERS: Array<{ value: '' | ControlStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'missing', label: 'Missing' },
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'passed', label: 'Passed' },
];

export function ControlsPage() {
  const [framework, setFramework] = useState<'all' | FrameworkKey>('soc2');
  const [status, setStatus] = useState<'' | ControlStatus>('');
  const [risk, setRisk] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('priority');
  const debouncedSearch = useDebounced(search, 250);

  const query = `/api/controls${buildQuery({
    framework: framework === 'all' ? undefined : framework,
    status: status || undefined,
    risk: risk || undefined,
    category: category || undefined,
    search: debouncedSearch || undefined,
    sort,
  })}`;

  const controls = useApi<ControlsResponse>(query);
  const summary = controls.data?.summary ?? [];
  const items = controls.data?.items ?? [];
  const hasFilters = Boolean(status || risk || category || debouncedSearch);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controls"
        subtitle="Every control in the library with the evidence that supports it — and what is still missing."
        meta={
          <>
            <Badge tone="outline" size="sm">
              {controls.data?.total ?? 0} controls
            </Badge>
            <Badge tone="neutral" size="sm">
              Readiness assessment only
            </Badge>
          </>
        }
        actions={
          <Button variant="secondary" size="md" onClick={controls.refetch} iconLeft={<LayoutList className="size-4" aria-hidden="true" />}>
            Refresh
          </Button>
        }
      />

      {/* Framework summary */}
      {summary.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {summary.map((frameworkSummary) => (
            <Card key={frameworkSummary.key} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-ink-900">{frameworkSummary.name}</h2>
                  <p className="mt-0.5 text-[12px] text-ink-500">
                    {frameworkSummary.counts.reviewed} of {frameworkSummary.counts.total} controls reviewed
                  </p>
                </div>
                <span className="metric-value text-2xl">{frameworkSummary.readinessIndex}%</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="pass" size="sm">
                  {frameworkSummary.counts.passed} passed
                </Badge>
                <Badge tone="warn" size="sm">
                  {frameworkSummary.counts.needsAttention} need attention
                </Badge>
                <Badge tone="danger" size="sm">
                  {frameworkSummary.counts.missing} missing
                </Badge>
                <Badge tone="neutral" size="sm">
                  {frameworkSummary.counts.needsReview} awaiting review
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {frameworkSummary.categories.slice(0, 8).map((entry) => (
                  <button
                    key={entry.category}
                    type="button"
                    onClick={() => {
                      setFramework(frameworkSummary.key);
                      setCategory(entry.category);
                    }}
                    className="rounded-full border border-ink-200 px-2 py-0.5 text-[11.5px] text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50"
                  >
                    {entry.category} <span className="tnum text-ink-400">{entry.count}</span>
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Filters */}
      <Card>
        <CardHeader
          title="Control library"
          description={controls.data?.disclaimer}
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
        />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              ariaLabel="Framework"
              value={framework}
              onChange={(value) => {
                setFramework(value);
                setCategory('');
              }}
              options={[
                { value: 'soc2', label: 'SOC 2' },
                { value: 'iso27001', label: 'ISO 27001' },
                { value: 'all', label: 'Both' },
              ]}
            />
            <SegmentedControl
              ariaLabel="Status"
              size="sm"
              value={status}
              onChange={setStatus}
              options={STATUS_FILTERS}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SearchInput label="Search controls" value={search} onChange={setSearch} placeholder="Search code, name or category…" />
            <Select aria-label="Filter by risk" value={risk} onChange={(event) => setRisk(event.target.value)}>
              <option value="">All risk levels</option>
              <option value="critical">Critical risk</option>
              <option value="high">High risk</option>
              <option value="medium">Medium risk</option>
              <option value="low">Low risk</option>
            </Select>
            <Select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {(controls.data?.filters.categories ?? [])
                .filter((entry, index, all) => all.findIndex((item) => item.category === entry.category) === index)
                .map((entry) => (
                  <option key={entry.category} value={entry.category}>
                    {entry.category}
                  </option>
                ))}
            </Select>
            <Select aria-label="Sort controls" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="priority">Sort: worst status first</option>
              <option value="risk">Sort: risk level</option>
              <option value="code">Sort: control code</option>
              <option value="confidence">Sort: lowest confidence</option>
            </Select>
          </div>

          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setStatus('');
                setRisk('');
                setCategory('');
                setSearch('');
              }}
              className="text-[12.5px] font-medium text-brand-700 hover:text-brand-800"
            >
              Clear filters
            </button>
          ) : null}
        </CardContent>
      </Card>

      {/* List */}
      {controls.loading && !controls.data ? (
        <LoadingBlock rows={6} />
      ) : controls.error ? (
        <ErrorState title="Could not load the control library" description={controls.error.message} onRetry={controls.refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No controls match these filters' : 'No controls available'}
          description={
            hasFilters
              ? 'Try a different status, risk level or category — or clear the filters to see the full library.'
              : 'The control library for this framework is empty in this build.'
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((control) => (
            <li key={control.id}>
              <Link
                to={`/app/controls/${control.id}`}
                className="surface flex flex-col gap-3 p-4 transition-shadow hover:shadow-raised sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11.5px] text-ink-500">{control.code}</span>
                    <Badge tone="neutral" size="sm">
                      {control.framework}
                    </Badge>
                    <Badge tone="outline" size="sm">
                      {control.category}
                    </Badge>
                    <RiskBadge risk={control.riskLevel} size="sm" />
                  </div>
                  <p className="mt-1.5 text-[14px] font-medium text-ink-900">{control.name}</p>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-500">{control.analysisNote}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-500">
                    <span>
                      Evidence: <span className="tnum text-ink-800">{control.matchedEvidence.length}</span> of{' '}
                      {control.requiredEvidence.length} items
                    </span>
                    <span>
                      Confidence: <span className="tnum text-ink-800">{Math.round(control.confidence * 100)}%</span>
                    </span>
                    {control.findingId ? (
                      <span>
                        Finding: <span className="text-ink-800">{control.priority}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={control.status} label={control.statusLabel} />
                  <ChevronRight className={cn('size-4 text-ink-300')} aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 ? (
        <div className="flex items-center justify-between text-[12px] text-ink-500">
          <span>Showing {items.length} controls</span>
          <Link to="/app/mappings" className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:text-brand-800">
            See evidence-to-control mapping
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
