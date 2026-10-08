import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, ShieldAlert } from 'lucide-react';
import { Badge, RiskBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { ErrorState, InlineAlert, LoadingBlock } from '@/components/ui/Feedback';
import { ScoreRing, StackedStatusBar } from '@/components/ui/ScoreRing';
import { SegmentedControl } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/app/PageHeader';
import { downloadFile, useApi } from '@/lib/api';
import { formatDateTime, scoreTone } from '@/lib/utils';
import type { ReportControlRow, ReportDetail } from '@/lib/types';

export function ReportDetailPage() {
  const { reportId = '' } = useParams();
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [statusView, setStatusView] = useState<'passed' | 'needsAttention' | 'missing' | 'needsReview'>('missing');
  const detail = useApi<{ report: ReportDetail }>(`/api/reports/${reportId}`);

  if (detail.loading && !detail.data) return <LoadingBlock rows={6} label="Loading report…" />;
  if (detail.error || !detail.data) {
    return (
      <ErrorState
        title="Report not found"
        description={detail.error?.message ?? 'This report may have been deleted from the workspace.'}
        onRetry={detail.refetch}
      />
    );
  }

  const report = detail.data.report;
  const summary = report.summary;
  const counts = summary.readiness.counts;

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile(`/api/reports/${report.id}/pdf`, report.fileName);
      toast.success('Download started', report.fileName);
    } catch (error) {
      toast.error('Download failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={report.name}
        subtitle={`${report.companyName} · ${report.framework} · generated ${formatDateTime(report.generatedAt)}`}
        breadcrumb={
          <Link to="/app/reports" className="inline-flex items-center gap-1.5 hover:text-ink-800">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to reports
          </Link>
        }
        meta={
          <>
            <Badge tone={report.status === 'ready' ? 'pass' : 'info'} size="sm">
              {report.status === 'ready' ? 'Ready' : report.status}
            </Badge>
            <Badge tone="outline" size="sm">
              {report.fileName}
            </Badge>
            <Badge tone="neutral" size="sm">
              Requested by {report.requestedBy}
            </Badge>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={download} loading={downloading} iconLeft={<Download className="size-4" aria-hidden="true" />}>
              Download PDF
            </Button>
            <ButtonLink to="/app/reports" variant="primary">
              All reports
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Executive summary" description={`${summary.analysisMode} · assessed by ${summary.conductedBy}`} />
            <CardContent className="space-y-4">
              {summary.executiveSummary.split('\n\n').map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="text-[13.5px] leading-relaxed text-ink-700">
                  {paragraph}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Control summary" description={`${report.framework} · ${summary.readiness.counts.total} controls reviewed`} />
            <CardContent className="space-y-5">
              <StackedStatusBar
                passed={counts.passed}
                needsAttention={counts.needsAttention}
                missing={counts.missing}
                needsReview={counts.needsReview}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {summary.categoryBreakdown.map((row) => (
                  <div key={row.category} className="rounded-lg border border-ink-200 px-3.5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[12.5px] font-medium text-ink-800">{row.category}</p>
                      <span className="tnum text-[12px] text-ink-500">{row.passed}/{row.total}</span>
                    </div>
                    <div className="mt-2">
                      <StackedStatusBar
                        passed={row.passed}
                        needsAttention={row.needsAttention}
                        missing={row.missing}
                        needsReview={row.needsReview}
                        showLegend={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Findings"
              description="Critical and high-risk findings included in this snapshot"
              icon={<ShieldAlert className="size-4" aria-hidden="true" />}
            />
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-[11.5px] font-medium tracking-wide text-danger-700 uppercase">Critical</p>
                {summary.criticalFindings.length === 0 ? (
                  <p className="mt-1.5 text-[12.5px] text-ink-500">No critical findings in this snapshot.</p>
                ) : (
                  <ul className="mt-1.5 space-y-2">
                    {summary.criticalFindings.map((finding) => (
                      <li key={finding.controlCode} className="flex items-start gap-2">
                        <RiskBadge risk={finding.riskLevel} size="sm" />
                        <span className="text-[12.5px] text-ink-700">
                          <span className="font-mono text-[11.5px] text-ink-500">{finding.controlCode}</span> {finding.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-[11.5px] font-medium tracking-wide text-warn-700 uppercase">High</p>
                {summary.highFindings.length === 0 ? (
                  <p className="mt-1.5 text-[12.5px] text-ink-500">No high-risk findings in this snapshot.</p>
                ) : (
                  <ul className="mt-1.5 space-y-2">
                    {summary.highFindings.map((finding) => (
                      <li key={finding.controlCode} className="flex items-start gap-2">
                        <RiskBadge risk={finding.riskLevel} size="sm" />
                        <span className="text-[12.5px] text-ink-700">
                          <span className="font-mono text-[11.5px] text-ink-500">{finding.controlCode}</span> {finding.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Controls by status"
              description="The exact control list behind the counts in the PDF, grouped by assessment status"
            />
            <CardContent className="space-y-3">
              <SegmentedControl
                ariaLabel="Control status"
                value={statusView}
                onChange={setStatusView}
                options={[
                  { value: 'missing', label: 'Missing', count: summary.controlsByStatus.missing.length },
                  { value: 'needsAttention', label: 'Partial', count: summary.controlsByStatus.needsAttention.length },
                  { value: 'needsReview', label: 'Review', count: summary.controlsByStatus.needsReview.length },
                  { value: 'passed', label: 'Passed', count: summary.controlsByStatus.passed.length },
                ]}
              />
              {(() => {
                const rows: ReportControlRow[] = summary.controlsByStatus[statusView] ?? [];
                if (rows.length === 0) {
                  return <p className="text-[12.5px] text-ink-500">No controls in this state.</p>;
                }
                return (
                  <ul className="divide-y divide-ink-100">
                    {rows.map((row) => (
                      <li key={row.controlCode} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-medium text-ink-800">
                            <span className="font-mono text-[11.5px] text-ink-500">{row.controlCode}</span> {row.name}
                          </p>
                          <p className="mt-0.5 text-[12px] text-ink-500">{row.detail}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <RiskBadge risk={row.riskLevel} size="sm" />
                          <span className="tnum text-[11.5px] text-ink-500">{Math.round(row.confidence * 100)}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Remediation recommendations" description="Generated guidance with suggested owners and timelines" />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-ink-200 text-[11px] tracking-wide text-ink-500 uppercase">
                    <th scope="col" className="px-5 py-2.5 font-medium">Control</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Recommended action</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Owner</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Timeline</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recommendations.map((row) => (
                    <tr key={`${row.controlCode}-${row.action}`} className="border-b border-ink-100 last:border-0">
                      <td className="px-5 py-3 align-top font-mono text-[11.5px] text-ink-600">{row.controlCode}</td>
                      <td className="px-3 py-3 align-top text-ink-700">{row.action}</td>
                      <td className="px-3 py-3 align-top text-ink-600">{row.owner}</td>
                      <td className="px-5 py-3 align-top text-ink-600">{row.timelineLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Evidence inventory"
              description={`${summary.evidenceInventory.length} documents were in the workspace when this report was generated`}
              icon={<FileText className="size-4" aria-hidden="true" />}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-ink-200 text-[11px] tracking-wide text-ink-500 uppercase">
                    <th scope="col" className="px-5 py-2.5 font-medium">File</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Category</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Size</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Mapped controls</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.evidenceInventory.map((item) => (
                    <tr key={`${item.fileName}-${item.uploadedAt}`} className="border-b border-ink-100 last:border-0">
                      <td className="px-5 py-2.5 font-medium text-ink-800">{item.fileName}</td>
                      <td className="px-3 py-2.5 text-ink-600">{item.category}</td>
                      <td className="px-3 py-2.5 text-ink-600">{item.sizeLabel}</td>
                      <td className="px-5 py-2.5 tnum text-ink-600">{item.mappedControls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <InlineAlert tone="warn" title="Report disclaimer">
            {summary.disclaimer}
          </InlineAlert>
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="flex flex-col items-center text-center">
              <ScoreRing value={summary.readiness.index} label={summary.readiness.bandLabel} sublabel={report.framework} />
              <p className={`mt-3 text-[13px] font-medium ${scoreTone(summary.readiness.index).text}`}>
                {summary.readiness.index}% readiness
              </p>
              <p className="mt-1 text-[12px] text-ink-500">
                {summary.readiness.openFindings} open findings across {counts.total} controls
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Score components" description="Weighted inputs to the readiness index" />
            <CardContent className="space-y-3">
              {summary.readiness.components.map((component) => {
                const percent = Math.round(component.value * 100);
                return (
                  <div key={component.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] text-ink-700">{component.label}</span>
                      <span className="tnum text-[12.5px] font-medium text-ink-800">
                        {percent}% <span className="font-normal text-ink-400">· {Math.round(component.weight * 100)}% weight</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-ink-800" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">{component.description}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Snapshot details" />
            <CardContent>
              <dl className="space-y-2.5 text-[12.5px]">
                {[
                  ['Company', report.companyName],
                  ['Framework', report.framework],
                  ['Generated', formatDateTime(report.generatedAt)],
                  ['Requested by', report.requestedBy],
                  ['Analysis mode', summary.analysisMode],
                  ['Score', `${summary.readiness.index}%`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <dt className="text-ink-500">{label}</dt>
                    <dd className="text-right font-medium text-ink-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Methodology" />
            <CardContent>
              <p className="text-[12.5px] leading-relaxed text-ink-600">{summary.readiness.methodology}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
