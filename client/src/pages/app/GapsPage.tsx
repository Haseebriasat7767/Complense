import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Filter, RefreshCw, TriangleAlert } from 'lucide-react';
import { Badge, PriorityBadge, RiskBadge, StatusBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, MetricTile } from '@/components/ui/Card';
import { EmptyState, ErrorState, InlineAlert, LoadingBlock } from '@/components/ui/Feedback';
import { SearchInput, Select } from '@/components/ui/Input';
import { PageHeader } from '@/components/app/PageHeader';
import { useApi, useDebounced } from '@/lib/api';
import type { ControlStatus, Finding, FrameworkKey, RiskLevel } from '@/lib/types';

type GapsResponse = {
  items: Finding[];
  total: number;
  ratings: { critical: number; high: number; medium: number; low: number; total: number };
  summary: {
    byRisk: Array<{ risk: RiskLevel; count: number }>;
    byFramework: Array<{ key: FrameworkKey; name: string; findings: number; readinessIndex: number }>;
    firstWave: number;
    categories: string[];
    owners: string[];
  };
  filters: {
    risks: RiskLevel[];
    statuses: ControlStatus[];
    frameworks: FrameworkKey[];
    categories: string[];
    owners: string[];
    priorities: string[];
  };
  guidanceNotice: string;
};

export function GapsPage() {
  const [framework, setFramework] = useState('');
  const [risk, setRisk] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [owner, setOwner] = useState('');
  const [priority, setPriority] = useState('');
  const [sort, setSort] = useState('severity');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 220);

  const query = `/api/gaps${buildQuery({
    framework: framework || undefined,
    risk: risk || undefined,
    status: status || undefined,
    category: category || undefined,
    owner: owner || undefined,
    priority: priority || undefined,
    sort,
    search: debouncedSearch || undefined,
  })}`;

  const gaps = useApi<GapsResponse>(query);
  const items = gaps.data?.items ?? [];
  const hasFilters = Boolean(framework || risk || status || category || owner || priority || debouncedSearch);

  const clearFilters = () => {
    setFramework('');
    setRisk('');
    setStatus('');
    setCategory('');
    setOwner('');
    setPriority('');
    setSearch('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Close your highest-risk gaps first."
        subtitle="Every control that is not fully evidenced becomes a finding, ranked by risk with a suggested owner and timeline."
        meta={
          <>
            <Badge tone="danger" size="sm">
              {gaps.data?.ratings.critical ?? 0} critical
            </Badge>
            <Badge tone="warn" size="sm">
              {gaps.data?.ratings.high ?? 0} high
            </Badge>
            <Badge tone="info" size="sm">
              {gaps.data?.ratings.medium ?? 0} medium
            </Badge>
            <Badge tone="pass" size="sm">
              {gaps.data?.ratings.low ?? 0} low
            </Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={gaps.refetch}
              iconLeft={<RefreshCw className={gaps.refreshing ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />}
            >
              Refresh
            </Button>
            <ButtonLink to="/app/reports" variant="primary" iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>
              Generate report
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Critical findings"
          value={gaps.data?.ratings.critical ?? 0}
          hint="No supporting evidence at all"
          tone="text-danger-700"
        />
        <MetricTile
          label="High findings"
          value={gaps.data?.ratings.high ?? 0}
          hint="Incomplete evidence on high-risk controls"
          tone="text-warn-700"
        />
        <MetricTile
          label="First remediation wave"
          value={gaps.data?.summary.firstWave ?? 0}
          hint="Critical + high findings combined"
        />
        <MetricTile
          label="Total open findings"
          value={gaps.data?.ratings.total ?? 0}
          hint="Across the selected scope"
        />
      </div>

      <InlineAlert tone="info" title="Generated guidance">
        {gaps.data?.guidanceNotice ??
          'Recommended fixes, owners and timelines are generated guidance. Validate them against your operating model.'}
      </InlineAlert>

      <Card>
        <CardHeader
          title="Filters"
          description="Narrow the list by framework, risk, status, category, owner or priority."
          icon={<Filter className="size-4" aria-hidden="true" />}
          actions={
            hasFilters ? (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Clear all
              </Button>
            ) : null
          }
        />
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput label="Search findings" value={search} onChange={setSearch} placeholder="Search control, title or detail…" />
          <Select aria-label="Framework" value={framework} onChange={(event) => setFramework(event.target.value)}>
            <option value="">Both frameworks</option>
            <option value="soc2">SOC 2</option>
            <option value="iso27001">ISO 27001</option>
          </Select>
          <Select aria-label="Risk level" value={risk} onChange={(event) => setRisk(event.target.value)}>
            <option value="">All risk levels</option>
            {(gaps.data?.filters.risks ?? []).map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </Select>
          <Select aria-label="Control status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All control statuses</option>
            <option value="missing">Missing evidence</option>
            <option value="needs_attention">Partial evidence</option>
            <option value="needs_review">Needs manual review</option>
          </Select>
          <Select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {(gaps.data?.filters.categories ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select aria-label="Suggested owner" value={owner} onChange={(event) => setOwner(event.target.value)}>
            <option value="">All suggested owners</option>
            {(gaps.data?.filters.owners ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select aria-label="Priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">All priorities</option>
            {(gaps.data?.filters.priorities ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select aria-label="Sort" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="severity">Sort: risk (highest first)</option>
            <option value="control">Sort: control code</option>
            <option value="owner">Sort: suggested owner</option>
            <option value="timeline">Sort: shortest timeline</option>
            <option value="category">Sort: category</option>
          </Select>
        </CardContent>
      </Card>

      {gaps.loading && !gaps.data ? (
        <LoadingBlock rows={6} />
      ) : gaps.error ? (
        <ErrorState title="Could not load the gap analysis" description={gaps.error.message} onRetry={gaps.refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<TriangleAlert className="size-5" aria-hidden="true" />}
          title={hasFilters ? 'No findings match these filters' : 'No open findings'}
          description={
            hasFilters
              ? 'Try relaxing the filters — the full list includes findings across both frameworks.'
              : 'Every reviewed control is fully evidenced. Upload new evidence or re-run an analysis to refresh the picture.'
          }
          action={hasFilters ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : null}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((finding) => (
              <li key={finding.id} className="surface p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <RiskBadge risk={finding.riskLevel} />
                      <PriorityBadge priority={finding.priority} />
                      <Badge tone="neutral" size="sm">
                        {finding.framework}
                      </Badge>
                      <Badge tone="outline" size="sm">
                        {finding.category}
                      </Badge>
                      <StatusBadge status={finding.controlStatus} size="sm" />
                    </div>
                    <h2 className="mt-2.5 text-[15px] font-semibold text-ink-900">{finding.title}</h2>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{finding.finding}</p>

                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-[11.5px] font-medium tracking-wide text-ink-500 uppercase">Control</dt>
                        <dd className="mt-0.5">
                          <Link
                            to={`/app/controls/${finding.controlId}`}
                            className="text-[12.5px] font-medium text-brand-700 hover:text-brand-800"
                          >
                            {finding.controlCode} · {finding.controlName}
                          </Link>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11.5px] font-medium tracking-wide text-ink-500 uppercase">Evidence</dt>
                        <dd className="mt-0.5 text-[12.5px] text-ink-700">
                          {finding.evidenceFound.length > 0
                            ? finding.evidenceFound.map((item) => item.fileName).join(', ')
                            : 'None found'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11.5px] font-medium tracking-wide text-danger-700 uppercase">Missing</dt>
                        <dd className="mt-0.5 text-[12.5px] text-ink-700">{finding.evidenceMissing.join('; ') || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-[11.5px] font-medium tracking-wide text-ink-500 uppercase">
                          Recommended fix
                        </dt>
                        <dd className="mt-0.5 text-[12.5px] text-ink-700">{finding.recommendation.fix}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="shrink-0 lg:w-56">
                    <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3.5">
                      <p className="text-[11.5px] tracking-wide text-ink-500 uppercase">Suggested owner</p>
                      <p className="mt-0.5 text-[13px] font-medium text-ink-900">{finding.recommendation.owner}</p>
                      <p className="mt-2.5 text-[11.5px] tracking-wide text-ink-500 uppercase">Suggested timeline</p>
                      <p className="mt-0.5 text-[13px] font-medium text-ink-900">{finding.recommendation.timelineLabel}</p>
                      <p className="mt-2 text-[11px] leading-relaxed text-ink-500">{finding.recommendation.priorityNote}</p>
                      <ButtonLink to={`/app/gaps/${finding.id}`} size="sm" variant="primary" fullWidth className="mt-3">
                        Remediation plan
                      </ButtonLink>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="grid gap-4 sm:grid-cols-2">
            {gaps.data?.summary.byFramework.map((entry) => (
              <Card key={entry.key} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13.5px] font-medium text-ink-900">{entry.name}</p>
                    <p className="mt-0.5 text-[12px] text-ink-500">
                      {entry.findings} findings · readiness {entry.readinessIndex}%
                    </p>
                  </div>
                  <ButtonLink to="/app/frameworks" size="sm" variant="ghost">
                    Frameworks
                  </ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
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
