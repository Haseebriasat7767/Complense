import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Download,
  Eye,
  FileText,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { Badge, EvidenceStatusBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, InlineAlert, LoadingBlock, ProgressBar } from '@/components/ui/Feedback';
import { Checkbox, Field, SearchInput, Select } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/app/PageHeader';
import { api, downloadFile, useApi, useDebounced } from '@/lib/api';
import { useSession } from '@/lib/session';
import { cn, formatDateTime } from '@/lib/utils';
import type { EvidenceItem, FrameworkKey } from '@/lib/types';

type EvidenceListResponse = {
  items: EvidenceItem[];
  total: number;
  categories: string[];
  uploads: { maxBytes: number; maxLabel: string; allowedExtensions: string[] };
  analysisMode: { label: string };
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'analyzed', label: 'Analyzed' },
  { value: 'analyzing', label: 'Analyzing' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'failed', label: 'Failed' },
] as const;

export function EvidencePage() {
  const { context } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 250);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [framework, setFramework] = useState('');

  const query = `/api/evidence${buildFilterQuery({ search: debouncedSearch, status, category, framework })}`;
  const list = useApi<EvidenceListResponse>(query);

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgressLabel, setUploadProgressLabel] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadFrameworks, setUploadFrameworks] = useState<FrameworkKey[]>(['soc2', 'iso27001']);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EvidenceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const allowed = list.data?.uploads.allowedExtensions ?? ['pdf', 'docx', 'txt', 'csv'];
  const maxLabel = list.data?.uploads.maxLabel ?? '10 MB';

  const filteredCount = list.data?.items.length ?? 0;
  const hasFilters = Boolean(debouncedSearch || status || category || framework);
  const isDemo = context?.workspace.isDemo ?? false;

  const accept = useMemo(() => allowed.map((extension) => `.${extension}`).join(','), [allowed]);

  const stageFiles = (files: File[]) => {
    setUploadError(null);
    const rejected: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!allowed.includes(extension)) {
        rejected.push(`${file.name} (.${extension} is not supported)`);
        continue;
      }
      const maxBytes = list.data?.uploads.maxBytes ?? 10 * 1024 * 1024;
      if (file.size > maxBytes) {
        rejected.push(`${file.name} (larger than ${maxLabel})`);
        continue;
      }
      accepted.push(file);
    }
    if (rejected.length > 0) {
      setUploadError(`These files were not added: ${rejected.join(', ')}. Allowed types: ${allowed.join(', ').toUpperCase()}.`);
    }
    setPendingFiles((current) => [...current, ...accepted].slice(0, 8));
  };

  const upload = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setUploadError(null);
    let succeeded = 0;
    let flagged = 0;

    for (const file of pendingFiles) {
      setUploadProgressLabel(`Analysing ${file.name}…`);
      const formData = new FormData();
      formData.append('file', file);
      if (uploadCategory) formData.append('category', uploadCategory);
      formData.append('frameworks', uploadFrameworks.join(','));
      try {
        const response = await api.post<{ evidence: EvidenceItem; message: string }>('/api/evidence', undefined, {
          formData,
        });
        succeeded += 1;
        if (response.evidence.status !== 'analyzed') flagged += 1;
      } catch (caught) {
        setUploadError(caught instanceof Error ? caught.message : `Upload failed for ${file.name}.`);
      }
    }

    setUploadProgressLabel(null);
    setUploading(false);
    setPendingFiles([]);
    list.refetch();

    if (succeeded > 0) {
      toast.success(
        `${succeeded} document${succeeded === 1 ? '' : 's'} uploaded`,
        flagged > 0
          ? `${flagged} document${flagged === 1 ? ' was' : 's were'} flagged for manual review — text extraction was incomplete.`
          : 'Analysis complete and mapped to controls.',
      );
    }
  };

  const analyze = async (item: EvidenceItem) => {
    setBusyId(item.id);
    try {
      const response = await api.post<{ message: string }>(`/api/evidence/${item.id}/analyze`);
      toast.success('Analysis complete', response.message);
      list.refetch();
    } catch (caught) {
      toast.error('Analysis failed', caught instanceof Error ? caught.message : undefined);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/evidence/${deleteTarget.id}`);
      toast.success('Evidence removed', `${deleteTarget.fileName} is no longer part of the assessment.`);
      setDeleteTarget(null);
      list.refetch();
    } catch (caught) {
      toast.error('Could not delete the document', caught instanceof Error ? caught.message : undefined);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence"
        subtitle="Upload and organize the evidence used in your readiness assessment."
        meta={
          <>
            <Badge tone="outline" size="sm">
              {list.data?.total ?? 0} documents
            </Badge>
            <Badge tone="neutral" size="sm">
              {list.data?.analysisMode.label ?? 'Demo Analysis Mode'}
            </Badge>
            {isDemo ? (
              <Badge tone="info" size="sm">
                Demo data
              </Badge>
            ) : null}
          </>
        }
        actions={
          <Button
            variant="primary"
            iconLeft={<UploadCloud className="size-4" aria-hidden="true" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload files
          </Button>
        }
      />

      {/* Uploader */}
      <Card>
        <CardHeader
          title="Add evidence"
          description={`Supported: ${allowed.join(', ').toUpperCase()} · up to ${maxLabel} per file · validated on the server`}
          icon={<UploadCloud className="size-4" aria-hidden="true" />}
        />
        <div className="p-4 sm:p-5">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              stageFiles(Array.from(event.dataTransfer.files));
            }}
            className={cn(
              'rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors',
              dragging ? 'border-brand-500 bg-brand-50/60' : 'border-ink-200 bg-ink-50/40',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={accept}
              className="sr-only"
              onChange={(event) => {
                stageFiles(Array.from(event.target.files ?? []));
                event.target.value = '';
              }}
              aria-label="Upload evidence files"
            />
            <span className="mx-auto flex size-10 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-500">
              <UploadCloud className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-[13.5px] font-medium text-ink-900">
              Drag and drop files here, or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-brand-700 underline underline-offset-4 hover:text-brand-800"
              >
                browse your computer
              </button>
            </p>
            <p className="mt-1.5 text-[12px] text-ink-500">
              Files are parsed in memory — the original upload is never written to disk or served back.
            </p>
          </div>

          {pendingFiles.length > 0 ? (
            <div className="mt-4 space-y-3">
              <ul className="space-y-2">
                {pendingFiles.map((file) => (
                  <li
                    key={file.name + file.size}
                    className="flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2"
                  >
                    <FileText className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-ink-800">{file.name}</span>
                      <span className="block text-[11.5px] text-ink-500">
                        {(file.size / 1024).toFixed(0)} KB · {file.type || 'unknown type'}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setPendingFiles((current) => current.filter((item) => item !== file))}
                      className="flex size-7 items-center justify-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" htmlFor="upload-category" hint="Used to group evidence in the workspace.">
                  <Select
                    id="upload-category"
                    value={uploadCategory}
                    onChange={(event) => setUploadCategory(event.target.value)}
                  >
                    <option value="">Let ComplyLens infer what it can</option>
                    {(list.data?.categories ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div>
                  <p className="text-[13px] font-medium text-ink-700">Frameworks</p>
                  <div className="mt-2 flex flex-wrap gap-4">
                    {(['soc2', 'iso27001'] as FrameworkKey[]).map((key) => (
                      <Checkbox
                        key={key}
                        checked={uploadFrameworks.includes(key)}
                        onChange={(checked) =>
                          setUploadFrameworks((current) =>
                            checked ? [...new Set([...current, key])] : current.filter((item) => item !== key),
                          )
                        }
                        label={key === 'soc2' ? 'SOC 2' : 'ISO 27001'}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {uploadError ? <InlineAlert tone="danger">{uploadError}</InlineAlert> : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  loading={uploading}
                  onClick={() => void upload()}
                  iconLeft={<UploadCloud className="size-4" aria-hidden="true" />}
                  disabled={uploadFrameworks.length === 0}
                >
                  Upload {pendingFiles.length} file{pendingFiles.length === 1 ? '' : 's'}
                </Button>
                <Button variant="ghost" onClick={() => setPendingFiles([])} disabled={uploading}>
                  Clear
                </Button>
                {uploadProgressLabel ? (
                  <span className="flex flex-1 items-center gap-2 text-[12px] text-ink-500">
                    <ProgressBar value={0.6} size="sm" label={uploadProgressLabel} />
                    {uploadProgressLabel}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {uploadError && pendingFiles.length === 0 ? (
            <div className="mt-4">
              <InlineAlert tone="warn">{uploadError}</InlineAlert>
            </div>
          ) : null}

          {uploadFrameworks.length === 0 && pendingFiles.length > 0 ? (
            <p className="mt-2 text-[12px] text-danger-700">Select at least one framework before uploading.</p>
          ) : null}
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          label="Search evidence"
          value={search}
          onChange={setSearch}
          placeholder="Search by file name, category or summary…"
          className="lg:max-w-sm"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:ml-auto lg:w-auto">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9.5"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All categories</option>
            {(list.data?.categories ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by framework"
            value={framework}
            onChange={(event) => setFramework(event.target.value)}
          >
            <option value="">Both frameworks</option>
            <option value="soc2">SOC 2</option>
            <option value="iso27001">ISO 27001</option>
          </Select>
        </div>
      </div>

      {/* List */}
      {list.loading && !list.data ? (
        <LoadingBlock rows={5} />
      ) : list.error ? (
        <ErrorState
          title="We could not load your evidence"
          description={list.error.message}
          onRetry={list.refetch}
          offline={list.error.code === 'network_error'}
        />
      ) : filteredCount === 0 ? (
        <EmptyState
          icon={hasFilters ? <Search className="size-5" aria-hidden="true" /> : <FileText className="size-5" aria-hidden="true" />}
          title={hasFilters ? 'No documents match these filters' : 'No evidence documents yet'}
          description={
            hasFilters
              ? 'Try clearing the search or filters to see the rest of the workspace evidence.'
              : 'Add your policies, procedures and records to start the readiness assessment. PDF, DOCX, TXT and CSV are supported.'
          }
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setCategory('');
                  setFramework('');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button variant="primary" onClick={() => fileInputRef.current?.click()} iconLeft={<UploadCloud className="size-4" />}>
                Upload evidence
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto scroll-area">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <caption className="sr-only">Evidence documents in this workspace</caption>
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50/60">
                    {['File name', 'Category', 'Size', 'Uploaded', 'Analysis', 'Framework', 'Actions'].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className={cn(
                          'px-4 py-3 text-[11.5px] font-semibold tracking-wide text-ink-500 uppercase',
                          heading === 'Actions' && 'text-right',
                        )}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.data?.items.map((item) => (
                    <tr key={item.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/70">
                      <td className="px-4 py-3">
                        <Link to={`/app/evidence/${item.id}`} className="group flex items-start gap-2.5">
                          <FileText className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block max-w-[240px] truncate text-[13px] font-medium text-ink-900 group-hover:text-brand-700">
                              {item.fileName}
                            </span>
                            <span className="mt-0.5 block max-w-[280px] truncate text-[11.5px] text-ink-500">
                              {item.mappedControlCount > 0
                                ? `Mapped to ${item.mappedControlCount} controls`
                                : item.status === 'failed'
                                  ? 'No extractable text'
                                  : 'Not yet mapped'}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="outline" size="sm">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="tnum px-4 py-3 text-[12.5px] text-ink-600">{item.sizeLabel}</td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-600">{formatDateTime(item.uploadedAt)}</td>
                      <td className="px-4 py-3">
                        <EvidenceStatusBadge status={item.status} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap gap-1">
                          {item.frameworkKeys.map((key) => (
                            <Badge key={key} tone="neutral" size="sm">
                              {key === 'soc2' ? 'SOC 2' : 'ISO 27001'}
                            </Badge>
                          ))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/app/evidence/${item.id}`)}
                            iconLeft={<Eye className="size-3.5" aria-hidden="true" />}
                            aria-label={`View ${item.fileName}`}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={busyId === item.id}
                            onClick={() => void analyze(item)}
                            iconLeft={<RefreshCw className="size-3.5" aria-hidden="true" />}
                          >
                            Analyze
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void downloadFile(`/api/evidence/${item.id}/text`, `${item.fileName}.txt`)}
                            iconLeft={<Download className="size-3.5" aria-hidden="true" />}
                            aria-label={`Download extracted text of ${item.fileName}`}
                          >
                            Text
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(item)}
                            iconLeft={<Trash2 className="size-3.5 text-danger-600" aria-hidden="true" />}
                            aria-label={`Delete ${item.fileName}`}
                          >
                            <span className="text-danger-700">Delete</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <ul className="space-y-3 lg:hidden">
            {list.data?.items.map((item) => (
              <li key={item.id} className="surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/app/evidence/${item.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink-900">{item.fileName}</span>
                    <span className="mt-1 block text-[12px] text-ink-500">
                      {item.category} · {item.sizeLabel}
                    </span>
                  </Link>
                  <EvidenceStatusBadge status={item.status} size="sm" />
                </div>
                <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-ink-500">{item.summary}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-200 pt-3 text-[11.5px]">
                  <div>
                    <dt className="text-ink-400">Uploaded</dt>
                    <dd className="text-ink-700">{formatDateTime(item.uploadedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-400">Mapped controls</dt>
                    <dd className="tnum text-ink-700">{item.mappedControlCount}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonLink to={`/app/evidence/${item.id}`} size="sm" variant="secondary">
                    View
                  </ButtonLink>
                  <Button size="sm" variant="secondary" loading={busyId === item.id} onClick={() => void analyze(item)}>
                    Analyze
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(item)}>
                    <span className="text-danger-700">Delete</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {list.data && list.data.total > list.data.items.length ? (
            <p className="text-center text-[12.5px] text-ink-500">
              Showing {list.data.items.length} of {list.data.total} documents.
            </p>
          ) : null}
        </>
      )}

      {list.data && list.data.items.length > 0 && (isDemo || list.data.items.some((item) => item.source === 'demo')) ? (
        <InlineAlert tone="info" title="Sample documents" icon={<AlertCircle className="size-4" aria-hidden="true" />}>
          Documents marked as demo data are synthetic samples created for the AcmeCloud demo workspace. They do not belong
          to a real organisation.
        </InlineAlert>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
        title="Delete this evidence?"
        description={deleteTarget ? `${deleteTarget.fileName} will be removed from the workspace and the assessment recomputed.` : ''}
        confirmLabel="Delete evidence"
      />
    </div>
  );
}

function buildFilterQuery(filters: {
  search?: string;
  status?: string;
  category?: string;
  framework?: string;
}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}
