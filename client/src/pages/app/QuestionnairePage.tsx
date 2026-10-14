import { useState } from 'react';
import { FileSearch, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/app/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';

type Source = { evidenceId: string; fileName: string; category: string; uploadedAt: string; matchedTerms: string[]; relevance: number; excerpt: string };
type Draft = { question: string; status: 'draft_needs_human_review' | 'unsupported'; draftAnswer: string; sources: Source[]; requiresHumanApproval: boolean; disclaimer: string };

export function QuestionnairePage() {
  const [question, setQuestion] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(''); setDraft(null);
    try { setDraft(await api.post<Draft>('/api/questionnaire/draft', { question })); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Could not search workspace evidence. Try again.'); }
    finally { setLoading(false); }
  }
  return <div className="space-y-6">
    <PageHeader title="Security questionnaire assistant" subtitle="Find relevant workspace evidence for a customer security question, with excerpts you can review before answering." />
    <InlineAlert tone="warning" title="Evidence-first, human-approved">This initial version uses transparent keyword matching. It does not independently verify controls or write a customer-ready claim. Review every excerpt and confirm it is current before responding.</InlineAlert>
    <Card>
      <CardHeader title="Question to research" description="Searches successfully analyzed evidence in the current workspace." icon={<FileSearch className="size-4" />} />
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="security-question" className="block text-[12.5px] font-medium text-ink-700">Customer security question</label>
          <textarea id="security-question" value={question} onChange={(event) => setQuestion(event.target.value)} minLength={8} maxLength={1200} required rows={4} placeholder="Example: How do you restrict access to production systems and review permissions?" className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11.5px] text-ink-500">{question.length}/1200 characters</span>
            <Button type="submit" disabled={loading || question.trim().length < 8}>{loading ? 'Searching evidence…' : 'Find supporting evidence'}</Button>
          </div>
        </form>
        {error ? <p role="alert" className="mt-3 text-sm text-danger-700">{error}</p> : null}
      </CardContent>
    </Card>
    {draft ? <div className="space-y-4">
      <Card>
        <CardHeader title={draft.status === 'unsupported' ? 'No supporting evidence found' : 'Draft research result'} description={draft.sources.length ? `${draft.sources.length} potentially relevant source(s) found` : 'No source met the minimum relevance threshold'} icon={draft.status === 'unsupported' ? <AlertTriangle className="size-4" /> : <ShieldCheck className="size-4" />} />
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-ink-700">{draft.draftAnswer}</p>
          <p className="text-[11.5px] leading-relaxed text-ink-500">{draft.disclaimer}</p>
        </CardContent>
      </Card>
      {draft.sources.map((source) => <Card key={source.evidenceId}>
        <CardHeader title={source.fileName} description={`${source.category} · keyword relevance ${source.relevance}%`} actions={<a href={`/app/evidence/${encodeURIComponent(source.evidenceId)}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">Open evidence <ExternalLink className="size-3.5" /></a>} />
        <CardContent className="space-y-3">
          <blockquote className="border-l-2 border-ink-300 pl-3 text-[13px] leading-relaxed text-ink-700">{source.excerpt}</blockquote>
          <div className="flex flex-wrap gap-1.5">{source.matchedTerms.map((term) => <span key={term} className="rounded-full bg-ink-100 px-2 py-1 text-[10.5px] text-ink-600">{term}</span>)}</div>
        </CardContent>
      </Card>)}
      <p className="text-xs text-ink-500">Before using a response externally, validate source ownership, effective date, scope, and whether the excerpt reflects actual practice. A relevance score is not a compliance score.</p>
    </div> : null}
  </div>;
}
