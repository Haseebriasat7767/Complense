import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, InlineAlert, LoadingBlock } from '@/components/ui/Feedback';
import { Field, Select } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/app/PageHeader';
import { api, downloadFile, useApi } from '@/lib/api';
import { formatDateTime, scoreTone } from '@/lib/utils';
import type { FrameworkKey, ReportDetail, ReportListItem } from '@/lib/types';

type ReportsResponse = {
  items: ReportListItem[];
  total: number;
  frameworks: Array<{ key: FrameworkKey; name: string; shortName: string }>;
  notice: string;
};

export function ReportsPage() {
  const toast = useToast();
  const [framework, setFramework] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateFramework, setGenerateFramework] = useState<FrameworkKey>('soc2');
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<ReportListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const reports = useApi<ReportsResponse>(`/api/reports${framework ? `?framework=${framework}` : ''}`);
  const items = reports.data?.items ?? [];

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await api.post<{ report: ReportDetail; message: string }>('/api/reports', {
        frameworkKey: generateFramework,
      });
      toast.success('Report generated', `${result.report.name} is ready to download.`);
      setGenerateOpen(false);
      reports.refetch();
    } catch (error) {
      toast.error('Could not generate the report', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const download = async (report: ReportListItem) => {
    setDownloadingId(report.id);
    try {
      await downloadFile(`/api/reports/${report.id}/pdf`, report.fileName);
      toast.success('Download started', report.fileName);
    } catch (error) {
      toast.error('Download failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/api/reports/${deleting.id}`);
      toast.success('Report removed', `${deleting.name} was deleted from this workspace.`);
      setDeleting(null);
      reports.refetch();
    } catch (error) {
      toast.error('Could not delete the report', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Readiness reports"
        subtitle="Generate a point-in-time readiness assessment from the evidence currently in the workspace, then download it as a branded PDF."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={reports.refetch}
              iconLeft={<RefreshCw className={reports.refreshing ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              onClick={() => setGenerateOpen(true)}
              iconLeft={<Plus className="size-4" aria-hidden="true" />}
            >
              Generate report
            </Button>
          </>
        }
      />

      <InlineAlert tone="neutral" title="What a report is">
        {reports.data?.notice ??
          'Reports are snapshots of the evidence in this workspace at the moment of generation. They are readiness assessments, not certifications or audit opinions.'}
      </InlineAlert>

      <Card>
        <CardHeader
          title="Generated reports"
          description="Each report is stored with the score and counts from the moment it was generated."
          actions={
            <Select
              aria-label="Filter by framework"
              className="h-8 w-auto min-w-36 text-[13px]"
              value={framework}
              onChange={(event) => setFramework(event.target.value)}
            >
              <option value="">All frameworks</option>
              <option value="soc2">SOC 2</option>
              <option value="iso27001">ISO 27001</option>
            </Select>
          }
        />

        {reports.loading && !reports.data ? (
          <CardContent>
            <LoadingBlock rows={4} label="Loading reports…" />
          </CardContent>
        ) : reports.error ? (
          <CardContent>
            <ErrorState
              title="Could not load reports"
              description={reports.error.message}
              onRetry={reports.refetch}
              offline={reports.error.code === 'network_error'}
            />
          </CardContent>
        ) : items.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<FileText className="size-5" aria-hidden="true" />}
              title="No reports yet"
              description="Generate your first readiness report to see the score, control summary and remediation plan in one document."
              action={
                <Button variant="primary" onClick={() => setGenerateOpen(true)} iconLeft={<Plus className="size-4" aria-hidden="true" />}>
                  Generate report
                </Button>
              }
            />
          </CardContent>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-ink-200 text-[11.5px] tracking-wide text-ink-500 uppercase">
                    <th scope="col" className="px-5 py-2.5 font-medium">Report name</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Framework</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Date</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Score</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((report) => (
                    <tr key={report.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                      <td className="px-5 py-3">
                        <Link to={`/app/reports/${report.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                          {report.name}
                        </Link>
                        <p className="mt-0.5 font-mono text-[11.5px] text-ink-400">{report.fileName}</p>
                      </td>
                      <td className="px-3 py-3 text-ink-600">{report.framework}</td>
                      <td className="px-3 py-3 text-ink-600">{formatDateTime(report.generatedAt)}</td>
                      <td className="px-3 py-3">
                        <span className={`tnum font-semibold ${scoreTone(report.scoreIndex).text}`}>{report.scoreIndex}%</span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={report.status === 'ready' ? 'pass' : report.status === 'failed' ? 'danger' : 'info'} size="sm">
                          {report.status === 'ready' ? 'Ready' : report.status === 'failed' ? 'Failed' : 'Generating'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <ButtonLink to={`/app/reports/${report.id}`} size="sm" variant="ghost">
                            View
                          </ButtonLink>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={downloadingId === report.id}
                            onClick={() => download(report)}
                            iconLeft={<Download className="size-3.5" aria-hidden="true" />}
                          >
                            PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${report.name}`}
                            onClick={() => setDeleting(report)}
                            iconLeft={<Trash2 className="size-3.5" aria-hidden="true" />}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-ink-100 lg:hidden">
              {items.map((report) => (
                <li key={report.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/app/reports/${report.id}`} className="text-[13.5px] font-medium text-ink-900">
                        {report.name}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-ink-500">
                        {report.framework} · {formatDateTime(report.generatedAt)}
                      </p>
                    </div>
                    <span className={`tnum shrink-0 text-[15px] font-semibold ${scoreTone(report.scoreIndex).text}`}>
                      {report.scoreIndex}%
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge tone={report.status === 'ready' ? 'pass' : report.status === 'failed' ? 'danger' : 'info'} size="sm">
                      {report.status === 'ready' ? 'Ready' : report.status === 'failed' ? 'Failed' : 'Generating'}
                    </Badge>
                    <ButtonLink to={`/app/reports/${report.id}`} size="sm" variant="ghost" className="ml-auto">
                      View
                    </ButtonLink>
                    <Button size="sm" variant="secondary" loading={downloadingId === report.id} onClick={() => download(report)}>
                      PDF
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <CardHeader
          title="What the PDF contains"
          description="A cover page plus twelve numbered sections, generated server-side from the current workspace snapshot."
        />
        <CardContent className="grid gap-2 text-[12.5px] text-ink-600 sm:grid-cols-2 lg:grid-cols-3">
          {[
            'Cover page: company, framework, assessment date, readiness score, analysis mode',
            '1. Executive summary',
            '2. Overall readiness score with weighted components',
            '3. Control summary and per-category breakdown',
            '4. Passed controls',
            '5. Partially covered controls',
            '6. Missing controls',
            '7. Controls awaiting manual review',
            '8. Critical findings',
            '9. High-risk findings',
            '10. Remediation recommendations with owners and timelines',
            '11. Evidence inventory',
            '12. Final readiness summary',
            'Report disclaimer panel',
            'Footer disclaimer on every page',
            'Demo Data and generated-guidance notes',
          ].map((item) => (
            <p key={item} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
              {item}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Continue the workflow" description="Reports close the loop — from here you can act on the findings." />
        <CardContent className="flex flex-wrap gap-2">
          <ButtonLink to="/app/gaps" variant="secondary" iconRight={<ArrowRight className="size-4" aria-hidden="true" />}>
            Review gap analysis
          </ButtonLink>
          <ButtonLink to="/app/evidence" variant="secondary">
            Upload more evidence
          </ButtonLink>
          <ButtonLink to="/app/frameworks" variant="secondary">
            Check framework readiness
          </ButtonLink>
        </CardContent>
      </Card>

      <Modal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generate a readiness report"
        description="The report is generated from the evidence in this workspace right now. Upload missing evidence first for a complete picture."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGenerateOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button variant="primary" loading={generating} onClick={generate}>
              Generate report
            </Button>
          </>
        }
      >
        <Field
          label="Framework"
          htmlFor="report-framework"
          hint="The seeded demo workspace scores 92% for SOC 2 and 78% for ISO 27001."
        >
          <Select
            id="report-framework"
            value={generateFramework}
            onChange={(event) => setGenerateFramework(event.target.value as FrameworkKey)}
          >
            <option value="soc2">SOC 2 — Trust Services Criteria</option>
            <option value="iso27001">ISO/IEC 27001 — Annex A</option>
          </Select>
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={deleteBusy}
        title="Delete this report?"
        description={
          deleting
            ? `${deleting.name} will be removed from the workspace. You can generate a new snapshot at any time.`
            : ''
        }
        confirmLabel="Delete report"
      />
    </div>
  );
}
