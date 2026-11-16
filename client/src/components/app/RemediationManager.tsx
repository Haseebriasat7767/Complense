import { useState, type FormEvent } from 'react';
import { api, useApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { InlineAlert, LoadingBlock } from '@/components/ui/Feedback';
import type { Finding, Priority, RemediationEvent, RemediationPriority, RemediationRecord, RemediationStatus } from '@/lib/types';

const priorityMap: Record<Priority, RemediationPriority> = {
  P1: 'critical',
  P2: 'high',
  P3: 'medium',
  P4: 'low',
};

const statusOptions: RemediationStatus[] = [
  'open',
  'in_progress',
  'blocked',
  'ready_for_review',
  'verified',
  'dismissed',
];

const statusLabel: Record<RemediationStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  blocked: 'Blocked',
  ready_for_review: 'Ready for review',
  verified: 'Verified',
  dismissed: 'Dismissed',
};

export function RemediationManager({ finding }: { finding: Finding }) {
  const plans = useApi<{ items: RemediationRecord[]; total: number }>(
    `/api/remediations?controlId=${encodeURIComponent(finding.controlId)}`,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const events = useApi<{ items: RemediationEvent[]; total: number }>(
    selectedId ? `/api/remediations/${selectedId}/events` : null,
    { enabled: Boolean(selectedId) },
  );
  const [title, setTitle] = useState(finding.title);
  const [owner, setOwner] = useState(finding.recommendation.owner);
  const [requiredProof, setRequiredProof] = useState(finding.evidenceMissing.join('; '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api.post<{ remediation: RemediationRecord }>('/api/remediations', {
        controlId: finding.controlId,
        controlCode: finding.controlCode,
        title,
        description: finding.recommendation.fix,
        owner,
        priority: priorityMap[finding.priority],
        requiredProof,
      });
      setSelectedId(result.remediation.id);
      plans.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the remediation plan.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: RemediationStatus) {
    setError('');
    try {
      await api.patch<{ remediation: RemediationRecord }>(`/api/remediations/${id}`, { status });
      plans.refetch();
      if (selectedId === id) events.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the remediation status.');
    }
  }

  return (
    <Card>
      <CardHeader
        title="Tracked remediation"
        description="Save an accountable action plan, update its status and retain an audit trail."
      />
      <CardContent className="space-y-4">
        {error ? <InlineAlert tone="danger" title="Could not save changes">{error}</InlineAlert> : null}
        <form onSubmit={createPlan} className="space-y-3 rounded-lg border border-ink-200 bg-ink-50/50 p-3.5">
          <div>
            <label htmlFor="remediation-title" className="mb-1 block text-[11.5px] font-medium text-ink-600">Plan title</label>
            <input id="remediation-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} required className="w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-900" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="remediation-owner" className="mb-1 block text-[11.5px] font-medium text-ink-600">Owner</label>
              <input id="remediation-owner" value={owner} onChange={(event) => setOwner(event.target.value)} maxLength={180} required className="w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-900" />
            </div>
            <div>
              <label htmlFor="remediation-proof" className="mb-1 block text-[11.5px] font-medium text-ink-600">Required proof</label>
              <input id="remediation-proof" value={requiredProof} onChange={(event) => setRequiredProof(event.target.value)} maxLength={4000} className="w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-[13px] text-ink-900" />
            </div>
          </div>
          <button type="submit" disabled={saving || !title.trim() || !owner.trim()} className="rounded-md bg-brand-700 px-3.5 py-2 text-[12.5px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Saving…' : 'Save remediation plan'}
          </button>
        </form>

        {plans.loading && !plans.data ? <LoadingBlock rows={2} /> : null}
        {plans.error ? <InlineAlert tone="danger" title="Could not load saved plans">{plans.error.message}</InlineAlert> : null}
        {plans.data?.items.length === 0 ? (
          <p className="text-[12.5px] text-ink-500">No saved remediation plans for this control yet.</p>
        ) : null}
        <div className="space-y-3">
          {plans.data?.items.map((plan) => (
            <div key={plan.id} className="rounded-lg border border-ink-200 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink-900">{plan.title}</p>
                  <p className="mt-1 text-[11.5px] text-ink-500">Owner: {plan.owner} · Priority: {plan.priority}</p>
                  <p className="mt-1 text-[11px] text-ink-400">Updated {formatDateTime(plan.updatedAt)}</p>
                </div>
                <select
                  aria-label={`Status for ${plan.title}`}
                  value={plan.status}
                  onChange={(event) => void updateStatus(plan.id, event.target.value as RemediationStatus)}
                  className="rounded-md border border-ink-300 bg-white px-2.5 py-1.5 text-[12px] text-ink-800"
                >
                  {statusOptions.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
                </select>
              </div>
              {plan.requiredProof ? <p className="mt-2 text-[12px] text-ink-600">Proof: {plan.requiredProof}</p> : null}
              <button
                type="button"
                onClick={() => setSelectedId(selectedId === plan.id ? null : plan.id)}
                className="mt-3 text-[12px] font-medium text-brand-700 hover:text-brand-800"
              >
                {selectedId === plan.id ? 'Hide audit history' : 'View audit history'}
              </button>
              {selectedId === plan.id ? (
                <div className="mt-3 border-t border-ink-200 pt-3">
                  {events.loading ? <LoadingBlock rows={1} /> : null}
                  {events.error ? <p className="text-[12px] text-danger-700">{events.error.message}</p> : null}
                  {events.data?.items.map((item) => (
                    <div key={item.id} className="py-1.5">
                      <p className="text-[12px] font-medium text-ink-800">{item.action.replaceAll('_', ' ')}</p>
                      <p className="text-[11.5px] text-ink-500">{item.detail} · {formatDateTime(item.at)}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
