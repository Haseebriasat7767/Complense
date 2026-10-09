import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { Badge, EvidenceStatusBadge, RiskBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState, InlineAlert, LoadingBlock, ProgressBar } from '@/components/ui/Feedback';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/app/PageHeader';
import { api, downloadFile, useApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import type { EvidenceDetail } from '@/lib/types';

export function EvidenceDetailPage() {
  const { evidenceId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const detail = useApi<EvidenceDetail>(`/api/evidence/${evidenceId}`);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (detail.loading && !detail.data) return <LoadingBlock rows={5} />;
  if (detail.error || !detail.data) {
    return (
      <ErrorState
        title="Evidence not found"
        description={detail.error?.message ?? 'This document may have been deleted from the workspace.'}
        onRetry={detail.refetch}
      />
    );
  }

  const document = detail.data;

  const analyze = async () => {
    setBusy(true);
    try {
      const response = await api.post<{ message: string }>(`/api/evidence/${document.id}/analyze`);
      toast.success('Analysis complete', response.message);
      detail.refetch();
    } catch (caught) {
      toast.error('Analysis failed', caught instanceof Error ? caught.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/evidence/${document.id}`);
      toast.success('Evidence removed', `${document.fileName} is no longer part of the assessment.`);
      navigate('/app/evidence');
    } catch (caught) {
      toast.error('Could not delete the document', caught instanceof Error ? caught.message : undefined);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={document.fileName}
        subtitle={document.summary}
        breadcrumb={
          <Link to="/app/evidence" className="inline-flex items-center gap-1.5 hover:text-ink-800">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to evidence
          </Link>
        }
        meta={
          <>
            <EvidenceStatusBadge status={document.status} />
            <Badge tone="outline" size="sm">
              {document.category}
            </Badge>
            {document.frameworkKeys.map((key) => (
              <Badge key={key} tone="neutral" size="sm">
                {key === 'soc2' ? 'SOC 2' : 'ISO 27001'}
              </Badge>
            ))}
            {document.isDemoSample ? (
              <Badge tone="info" size="sm">
                Demo data
              </Badge>
            ) : (
              <Badge tone="brand" size="sm">
                Uploaded file
              </Badge>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => void analyze()}
              iconLeft={<RefreshCw className="size-4" aria-hidden="true" />}
            >
              Analyze
            </Button>
            <Button
              variant="secondary"
              onClick={() => void downloadFile(`/api/evidence/${document.id}/text`, `${document.fileName}.txt`)}
              iconLeft={<Download className="size-4" aria-hidden="true" />}
            >
              Extracted text
            </Button>
            {document.originalFileAvailable ? (
              <Button
                variant="secondary"
                onClick={() => void downloadFile(`/api/evidence/${document.id}/file`, document.fileName)}
                iconLeft={<Download className="size-4" aria-hidden="true" />}
              >
                Original file
              </Button>
            ) : null}
            <Button
              variant="danger"
              onClick={() => setConfirmDelete(true)}
              iconLeft={<Trash2 className="size-4" aria-hidden="true" />}
            >
              Delete
            </Button>
          </>
        }
      />

      {document.status === 'failed' ? (
        <InlineAlert tone="danger" title="Analysis failed">
          No text layer was found in this document, so it could not be mapped to any control. Re-upload a text-based
          export (PDF with selectable text, DOCX, TXT or CSV) or an OCR-processed copy. This document does not close any
          control.
        </InlineAlert>
      ) : document.status === 'needs_review' ? (
        <InlineAlert tone="warn" title="Needs manual review">
          Extraction quality was low, so this document is treated as a weak mention only — it never marks a control as
          passed until the content is verified.
        </InlineAlert>
      ) : (
        <InlineAlert tone="pass" title="Analyzed">
          {document.mappedControlCount > 0
            ? `Text extraction succeeded and this document maps to ${document.mappedControlCount} controls.`
            : 'Text extraction succeeded, but the content did not match any required evidence items in the control library.'}
        </InlineAlert>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Mapped controls"
              description={`${document.mapping.length} control${document.mapping.length === 1 ? '' : 's'} supported by this document`}
              icon={<FileText className="size-4" aria-hidden="true" />}
            />
            {document.mapping.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-500 sm:px-5">
                No required evidence items matched this document. Check the category and framework selection, or upload a
                document that covers the control requirements.
              </p>
            ) : (
              <ul className="divide-y divide-ink-200">
                {document.mapping.map((entry) => (
                  <li key={entry.controlId} className="px-4 py-3.5 sm:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link to={`/app/controls/${entry.controlId}`} className="min-w-0 group">
                        <span className="font-mono text-[11.5px] text-ink-500">{entry.controlCode}</span>
                        <span className="mt-0.5 block text-[13.5px] font-medium text-ink-900 group-hover:text-brand-700">
                          {entry.controlName}
                        </span>
                      </Link>
                      <Badge tone="outline" size="sm">
                        Confidence {Math.round(entry.confidence * 100)}%
                      </Badge>
                    </div>
                    <div className="mt-2.5">
                      <ProgressBar value={entry.confidence} size="sm" label={`Mapping confidence for ${entry.controlCode}`} />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[11.5px] font-medium tracking-wide text-pass-700 uppercase">Supports</p>
                        <ul className="mt-1 space-y-0.5">
                          {entry.matchedItems.map((item) => (
                            <li key={item} className="text-[12.5px] text-ink-600">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {entry.missingItems.length > 0 ? (
                        <div>
                          <p className="text-[11.5px] font-medium tracking-wide text-danger-700 uppercase">Still missing</p>
                          <ul className="mt-1 space-y-0.5">
                            {entry.missingItems.map((item) => (
                              <li key={item} className="text-[12.5px] text-ink-600">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Extracted text"
              description={
                document.originalFileAvailable
                  ? 'This is the text retained for analysis. The original file is kept in private storage and can be downloaded above.'
                  : 'This is the text retained for analysis — the original file is not stored.'
              }
            />
            <pre className="max-h-[420px] overflow-auto scroll-area px-4 py-4 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink-700 sm:px-5">
              {document.extractedText || 'No text could be extracted from this document.'}
            </pre>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Document details" />
            <dl className="divide-y divide-ink-200">
              {[
                ['File name', document.fileName],
                ['Type', document.fileExtension.toUpperCase()],
                ['Size', document.sizeLabel],
                ['Category', document.category],
                ['Uploaded', formatDateTime(document.uploadedAt)],
                ['Uploaded by', document.uploadedBy],
                ['Analysis status', document.status.replace('_', ' ')],
                ['Mapped controls', String(document.mappedControlCount)],
                ['Source', document.isDemoSample ? 'Demo sample data' : 'Uploaded file'],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[130px_1fr] gap-3 px-4 py-2.5 sm:px-5">
                  <dt className="text-[12px] text-ink-500">{label}</dt>
                  <dd className="text-[12.5px] text-ink-800">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Findings linked to this evidence" />
            {document.mapping.some((entry) => entry.missingItems.length > 0) ? (
              <ul className="divide-y divide-ink-200">
                {document.mapping
                  .filter((entry) => entry.missingItems.length > 0)
                  .slice(0, 6)
                  .map((entry) => (
                    <li key={entry.controlId} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                      <span className="min-w-0">
                        <span className="block font-mono text-[11.5px] text-ink-500">{entry.controlCode}</span>
                        <span className="mt-0.5 block text-[12.5px] text-ink-700">
                          Missing: {entry.missingItems.join('; ')}
                        </span>
                      </span>
                      <ButtonLink to={`/app/controls/${entry.controlId}`} size="sm" variant="ghost">
                        Open
                      </ButtonLink>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="px-4 py-5 text-[13px] text-ink-500 sm:px-5">
                This document fully supports every control it maps to.
              </p>
            )}
          </Card>

          <div className="surface p-4">
            <p className="text-[12.5px] font-medium text-ink-900">Mapping model</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-500">
              Matching is deterministic: each control declares the evidence items it expects and the signal phrases the
              engine looks for. The same document always produces the same mapping.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
              Risk ratings shown elsewhere in the workspace come from the control library rather than this document.
            </p>
            <RiskBadge risk="medium" size="sm" className="mt-3" />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
        loading={deleting}
        title="Delete this evidence?"
        description={`${document.fileName} will be removed from the workspace and every control it supports will be re-assessed.`}
        confirmLabel="Delete evidence"
      />
    </div>
  );
}
