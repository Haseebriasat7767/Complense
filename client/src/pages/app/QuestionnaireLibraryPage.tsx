/**
 * Reusable questionnaire library.
 *
 * Answer once, reuse across questionnaires — but only after a human
 * explicitly reviews and confirms the reuse. Nothing is copied into a
 * questionnaire automatically, and every reused answer is labelled as such
 * in the export.
 */
import { useCallback, useEffect, useState } from 'react';
import { BookOpenCheck, Download, FileText, Plus, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/app/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/Feedback';
import { Checkbox, Field, Input, Select } from '@/components/ui/Input';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { api, ApiError, downloadFile, useApi } from '@/lib/api';

type CanonicalQuestion = {
  slug: string;
  framework: 'soc2' | 'iso27001' | 'generic';
  category: string;
  question: string;
  guidance: string;
  relatedControls: string[];
};

type ReusableAnswer = {
  id: string;
  questionSlug: string;
  framework: string;
  question: string;
  answer: string;
  status: 'draft' | 'approved';
  updatedBy: string;
  updatedAt: string;
};

type QuestionnaireItem = {
  id: string;
  questionnaireId: string;
  questionSlug?: string;
  customQuestion?: string;
  framework: string;
  category: string;
  question: string;
  answer?: string;
  answerSource: 'none' | 'library' | 'custom';
  reuseConfirmed: boolean;
  status: 'unanswered' | 'answered' | 'needs_review';
  suggestedAnswer?: ReusableAnswer | null;
};

type Questionnaire = {
  id: string;
  title: string;
  requester: string;
  status: 'draft' | 'in_progress' | 'completed';
  answered: number;
  total: number;
  createdAt: string;
  updatedAt: string;
};

type QuestionnaireDetail = {
  questionnaire: Questionnaire;
  items: QuestionnaireItem[];
  answered: number;
  total: number;
};

const BASE = '/api/questionnaire-library';

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.';
}

export function QuestionnaireLibraryPage() {
  const { success } = useToast();
  const [tab, setTab] = useState<'questionnaires' | 'library'>('questionnaires');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const questionnaires = useApi<{ items: Questionnaire[]; total: number }>(`${BASE}/questionnaires`);
  const answers = useApi<{ items: ReusableAnswer[]; total: number }>(`${BASE}/answers`);
  const catalog = useApi<{ items: CanonicalQuestion[]; total: number }>(`${BASE}/catalog`);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<QuestionnaireDetail | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newRequester, setNewRequester] = useState('');

  const [addSlug, setAddSlug] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [reuseConfirm, setReuseConfirm] = useState<Record<string, boolean>>({});

  const [newAnswerSlug, setNewAnswerSlug] = useState('');
  const [newAnswerText, setNewAnswerText] = useState('');
  const [newAnswerStatus, setNewAnswerStatus] = useState<'draft' | 'approved'>('draft');

  const loadDetail = useCallback(async (id: string) => {
    try {
      const data = await api.get<QuestionnaireDetail>(`${BASE}/questionnaires/${id}`);
      setDetail(data);
      setOpenId(id);
      setAnswerDrafts(Object.fromEntries(data.items.map((item) => [item.id, item.answer ?? ''])));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    if (openId) void loadDetail(openId);
  }, [openId, loadDetail]);

  async function createQuestionnaire(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await api.post<{ questionnaire: Questionnaire }>(`${BASE}/questionnaires`, {
        title: newTitle.trim(),
        requester: newRequester.trim(),
      });
      setNewTitle('');
      setNewRequester('');
      questionnaires.refetch();
      success('Questionnaire created', created.questionnaire.title);
      await loadDetail(created.questionnaire.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      const body = addSlug ? { questionSlug: addSlug } : { customQuestion: customQuestion.trim() };
      const created = await api.post<{ item: QuestionnaireItem; suggestedAnswer: ReusableAnswer | null; message: string }>(
        `${BASE}/questionnaires/${detail.questionnaire.id}/items`,
        body,
      );
      setAddSlug('');
      setCustomQuestion('');
      success('Question added', created.message);
      await loadDetail(detail.questionnaire.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReuse(item: QuestionnaireItem) {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`${BASE}/questionnaires/${detail.questionnaire.id}/items/${item.id}/reuse`, { confirm: true });
      success('Library answer reused', 'The answer was copied only because you confirmed it.');
      await loadDetail(detail.questionnaire.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveAnswer(item: QuestionnaireItem, saveToLibrary: boolean) {
    if (!detail) return;
    const answer = (answerDrafts[item.id] ?? '').trim();
    if (!answer) {
      setError('Write an answer before saving it.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post(`${BASE}/questionnaires/${detail.questionnaire.id}/items/${item.id}/answer`, {
        answer,
        saveToLibrary,
      });
      success('Answer saved', saveToLibrary ? 'Answer saved and added to the reusable library.' : 'Answer saved for this questionnaire.');
      await loadDetail(detail.questionnaire.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveLibraryAnswer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`${BASE}/answers`, {
        questionSlug: newAnswerSlug,
        answer: newAnswerText.trim(),
        status: newAnswerStatus,
      });
      setNewAnswerSlug('');
      setNewAnswerText('');
      setNewAnswerStatus('draft');
      answers.refetch();
      success('Reusable answer saved', 'It can now be suggested in any questionnaire.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function exportQuestionnaire(format: 'pdf' | 'csv') {
    if (!detail) return;
    try {
      await downloadFile(`${BASE}/questionnaires/${detail.questionnaire.id}/export?format=${format}`, `questionnaire.${format}`);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function downloadAuditorPackage() {
    try {
      await downloadFile(`${BASE}/auditor-package?framework=soc2`, 'auditor-package.pdf');
      success('Auditor package downloaded', 'Readiness scores, controls, findings, evidence and approved answers in one PDF.');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const catalogItems = catalog.data?.items ?? [];
  const selectedCanonical = catalogItems.find((item) => item.slug === addSlug);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Questionnaire library"
        subtitle="Answer once, reuse across every customer security questionnaire — with a human confirming each reuse. Exports are ready to hand to a buyer or an auditor."
        actions={
          <Button variant="secondary" onClick={downloadAuditorPackage}>
            <Download className="size-4" /> Auditor package (PDF)
          </Button>
        }
      />
      <InlineAlert tone="info" title="Human-confirmed reuse only">
        A reusable answer is suggested — never copied — until you review it and confirm. Reused answers are labelled in every export, so a buyer always knows what was reused and what was written fresh.
      </InlineAlert>
      {error ? <p role="alert" className="text-sm text-danger-700">{error}</p> : null}

      <Tabs
        ariaLabel="Questionnaire library sections"
        items={[
          { id: 'questionnaires', label: 'Questionnaires' },
          { id: 'library', label: 'Answer library' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      <TabPanel id="questionnaires" active={tab}>
        <div className="space-y-5">
          <Card>
            <CardHeader title="New questionnaire" description="One questionnaire per customer security review." icon={<Plus className="size-4" />} />
            <CardContent>
              <form onSubmit={createQuestionnaire} className="flex flex-wrap items-end gap-3">
                <Field label="Title" className="min-w-56 flex-1">
                  <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} required maxLength={180} placeholder="Example: Acme Corp vendor security review" />
                </Field>
                <Field label="Requested by" className="min-w-48 flex-1">
                  <Input value={newRequester} onChange={(event) => setNewRequester(event.target.value)} maxLength={180} placeholder="Customer or prospect name" />
                </Field>
                <Button type="submit" disabled={busy || !newTitle.trim()}>Create questionnaire</Button>
              </form>
              {questionnaires.error ? <p role="alert" className="mt-3 text-sm text-danger-700">{errorMessage(questionnaires.error)}</p> : null}
            </CardContent>
          </Card>

          {questionnaires.data?.items.map((item) => (
            <Card key={item.id}>
              <CardHeader
                title={item.title}
                description={`${item.requester ? `Requested by ${item.requester} · ` : ''}${item.answered}/${item.total} answered · ${item.status}`}
                actions={
                  <Button variant="secondary" onClick={() => void loadDetail(item.id)}>
                    {openId === item.id ? 'Refresh' : 'Open'}
                  </Button>
                }
              />
              {openId === item.id && detail && detail.questionnaire.id === item.id ? (
                <CardContent className="space-y-5 border-t border-ink-200">
                  <form onSubmit={addItem} className="space-y-3">
                    <Field label="Add a question from the catalog (25 seeded questions)">
                      <Select value={addSlug} onChange={(event) => setAddSlug(event.target.value)}>
                        <option value="">Choose a canonical question…</option>
                        {catalogItems.map((question) => (
                          <option key={question.slug} value={question.slug}>
                            [{question.framework.toUpperCase()}] {question.question}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {selectedCanonical ? <p className="text-[12.5px] text-ink-500">{selectedCanonical.guidance}</p> : null}
                    <Field label="Or add a custom question">
                      <Input
                        value={customQuestion}
                        onChange={(event) => setCustomQuestion(event.target.value)}
                        maxLength={1200}
                        placeholder="Paste the customer's exact question"
                        disabled={Boolean(addSlug)}
                      />
                    </Field>
                    <Button type="submit" disabled={busy || (!addSlug && !customQuestion.trim())}>Add question</Button>
                  </form>

                  {detail.items.length === 0 ? (
                    <p className="text-[13.5px] text-ink-500">No questions yet. Add one from the catalog or paste a custom question.</p>
                  ) : (
                    <ul className="space-y-4">
                      {detail.items.map((questionItem) => (
                        <li key={questionItem.id} className="rounded-xl border border-ink-200 px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-[13.5px] font-medium text-ink-900">{questionItem.question}</p>
                            <Badge tone={questionItem.status === 'answered' ? 'brand' : 'outline'} size="sm">
                              {questionItem.status === 'answered'
                                ? questionItem.answerSource === 'library'
                                  ? 'Answered · reused from library'
                                  : 'Answered'
                                : 'Unanswered'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[12px] text-ink-500">{questionItem.category} · {questionItem.framework}</p>

                          {questionItem.suggestedAnswer && questionItem.answerSource === 'none' ? (
                            <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/40 px-3 py-3">
                              <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-900">
                                <BookOpenCheck className="size-4" /> Suggested from your library ({questionItem.suggestedAnswer.status})
                              </p>
                              <p className="mt-1 text-[13px] text-ink-700">{questionItem.suggestedAnswer.answer}</p>
                              <div className="mt-2">
                                <Checkbox
                                  checked={reuseConfirm[questionItem.id] ?? false}
                                  onChange={(checked) => setReuseConfirm((current) => ({ ...current, [questionItem.id]: checked }))}
                                  label="I reviewed this answer and confirm it applies to this questionnaire."
                                />
                              </div>
                              <Button
                                className="mt-2"
                                disabled={busy || !(reuseConfirm[questionItem.id] ?? false)}
                                onClick={() => void confirmReuse(questionItem)}
                              >
                                <ShieldCheck className="size-4" /> Reuse this answer
                              </Button>
                            </div>
                          ) : null}

                          <div className="mt-3 space-y-2">
                            <textarea
                              value={answerDrafts[questionItem.id] ?? ''}
                              onChange={(event) => setAnswerDrafts((current) => ({ ...current, [questionItem.id]: event.target.value }))}
                              rows={3}
                              maxLength={8000}
                              placeholder="Write the answer for this questionnaire…"
                              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button variant="secondary" disabled={busy} onClick={() => void saveAnswer(questionItem, false)}>
                                Save answer
                              </Button>
                              <Button variant="secondary" disabled={busy || !questionItem.questionSlug} onClick={() => void saveAnswer(questionItem, true)}>
                                Save answer &amp; add to library
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-ink-200 pt-4">
                    <Button variant="secondary" onClick={() => void exportQuestionnaire('pdf')}>
                      <FileText className="size-4" /> Export PDF
                    </Button>
                    <Button variant="secondary" onClick={() => void exportQuestionnaire('csv')}>Export CSV</Button>
                    <span className="self-center text-[12px] text-ink-500">
                      {detail.answered}/{detail.total} answered
                    </span>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          ))}
          {questionnaires.data?.items.length === 0 && !questionnaires.loading ? (
            <p className="text-[13.5px] text-ink-500">No questionnaires yet. Create the first one above.</p>
          ) : null}
        </div>
      </TabPanel>

      <TabPanel id="library" active={tab}>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Save a reusable answer" description="Write it once. It will be suggested — never auto-applied — in every future questionnaire." icon={<BookOpenCheck className="size-4" />} />
            <CardContent>
              <form onSubmit={saveLibraryAnswer} className="space-y-3">
                <Field label="Canonical question">
                  <Select value={newAnswerSlug} onChange={(event) => setNewAnswerSlug(event.target.value)} required>
                    <option value="">Choose a question…</option>
                    {catalogItems.map((question) => (
                      <option key={question.slug} value={question.slug}>
                        [{question.framework.toUpperCase()}] {question.question}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Answer">
                  <textarea
                    value={newAnswerText}
                    onChange={(event) => setNewAnswerText(event.target.value)}
                    rows={4}
                    maxLength={8000}
                    required
                    placeholder="Write the answer exactly as a customer should receive it…"
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </Field>
                <Field label="Status">
                  <Select value={newAnswerStatus} onChange={(event) => setNewAnswerStatus(event.target.value as 'draft' | 'approved')}>
                    <option value="draft">Draft — needs review before reuse</option>
                    <option value="approved">Approved — ready to reuse</option>
                  </Select>
                </Field>
                <Button type="submit" disabled={busy || !newAnswerSlug || !newAnswerText.trim()}>Save to library</Button>
              </form>
            </CardContent>
          </Card>

          {answers.error ? <p role="alert" className="text-sm text-danger-700">{errorMessage(answers.error)}</p> : null}
          {answers.data?.items.map((answer) => (
            <Card key={answer.id}>
              <CardHeader
                title={answer.question}
                description={`${answer.framework} · last updated by ${answer.updatedBy || '—'}`}
                actions={<Badge tone={answer.status === 'approved' ? 'brand' : 'outline'} size="sm">{answer.status}</Badge>}
              />
              <CardContent>
                <p className="text-[13.5px] leading-relaxed text-ink-700">{answer.answer}</p>
              </CardContent>
            </Card>
          ))}
          {answers.data?.items.length === 0 && !answers.loading ? (
            <p className="text-[13.5px] text-ink-500">
              The library is empty. Save your first reusable answer above, or answer a questionnaire question and choose “Save answer &amp; add to library”.
            </p>
          ) : null}
        </div>
      </TabPanel>
    </div>
  );
}
