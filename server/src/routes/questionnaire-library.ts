/**
 * Reusable questionnaire library.
 *
 * Answer once, reuse across questionnaires — but only ever with a human
 * explicitly confirming the reuse. Suggestions are matched by canonical
 * question slug (or exact normalised text), never by fuzzy similarity, and
 * nothing is copied into a questionnaire until the reviewer confirms it.
 *
 * Also serves the auditor evidence package: readiness scores, control
 * status, open findings, evidence inventory and approved reusable answers
 * in one PDF an auditor can review.
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import { assertWithinLimit } from '../billing/entitlements.js';
import { CANONICAL_QUESTIONS, findCanonicalByText, findCanonicalQuestion } from '../domain/questionnaire-catalog.js';
import { mapEvidenceAcrossFrameworks } from '../domain/analysis.js';
import { CONTROL_LIBRARY } from '../domain/controls.js';
import { FRAMEWORKS, isFrameworkKey } from '../domain/frameworks.js';
import { snapshotForFramework } from '../services/readiness.js';
import { renderAuditorPackagePdf, renderQuestionnairePdf } from '../pdf/questionnaire.js';
import { ApiError, asyncHandler } from '../http/errors.js';
import { optionalBoolean, optionalEnum, optionalString, queryString, requireObjectBody, requireString } from '../http/validate.js';
import { getStore } from '../store/index.js';
import { resolveWorkspace } from './workspace.js';
import type { QuestionnaireItem, QuestionnaireStatus, ReusableAnswer, ReusableAnswerStatus } from '../domain/types.js';

export const questionnaireLibraryRouter = Router();
questionnaireLibraryRouter.use(requireAuth());

function id(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}

function csvCell(value: string): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/* ------------------------------- catalog -------------------------------- */

questionnaireLibraryRouter.get(
  '/questionnaire-library/catalog',
  asyncHandler(async (req, res) => {
    const framework = queryString(req.query.framework);
    const category = queryString(req.query.category)?.toLowerCase();
    let items = CANONICAL_QUESTIONS;
    if (framework) items = items.filter((item) => item.framework === framework);
    if (category) items = items.filter((item) => item.category.toLowerCase() === category);
    res.json({
      items,
      total: items.length,
      frameworks: ['soc2', 'iso27001', 'generic'],
      note: 'Canonical questions buyers ask most often. Reuse is suggested only by exact question match — never by fuzzy similarity.',
    });
  }),
);

/* --------------------------- reusable answers --------------------------- */

questionnaireLibraryRouter.get(
  '/questionnaire-library/answers',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const store = getStore();
    let answers = await store.listReusableAnswers(session.org);
    const framework = queryString(req.query.framework);
    const status = queryString(req.query.status);
    if (framework) answers = answers.filter((answer) => answer.framework === framework);
    if (status) answers = answers.filter((answer) => answer.status === status);
    res.json({ items: answers, total: answers.length });
  }),
);

questionnaireLibraryRouter.post(
  '/questionnaire-library/answers',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const body = requireObjectBody(req.body);
    const store = getStore();
    const organization = await store.getOrganization(session.org);
    if (!organization) throw ApiError.notFound('Organisation not found.');
    const workspace = await resolveWorkspace(req, optionalString(body.workspaceId, 'workspaceId', 120));

    const questionSlug = optionalString(body.questionSlug, 'questionSlug', 120);
    const canonical = questionSlug ? findCanonicalQuestion(questionSlug) : undefined;
    if (questionSlug && !canonical) throw ApiError.badRequest(`Unknown canonical question slug: ${questionSlug}.`);
    const question = canonical?.question ?? requireString(body.question, 'question', { max: 1200 });
    const answer = requireString(body.answer, 'answer', { max: 8000 });
    const status = optionalEnum(body.status, 'status', ['draft', 'approved'] as const) ?? 'draft';
    const sourceEvidenceIds = Array.isArray(body.sourceEvidenceIds)
      ? (body.sourceEvidenceIds as unknown[]).filter((value): value is string => typeof value === 'string').slice(0, 20)
      : [];
    const now = new Date().toISOString();

    // One reusable answer per organisation per canonical question: saving
    // again updates the existing answer instead of creating a duplicate.
    const slug = canonical?.slug ?? `custom-${crypto.randomBytes(6).toString('hex')}`;
    const existing = canonical ? await store.getReusableAnswerBySlug(session.org, slug) : null;
    if (existing) {
      const updated = await store.updateReusableAnswer(existing.id, session.org, {
        answer,
        status,
        sourceEvidenceIds,
        updatedBy: session.email,
        updatedAt: now,
      });
      res.json({ answer: updated, message: 'Reusable answer updated.' });
      return;
    }

    await assertWithinLimit(organization, 'reusableAnswers');
    const created = await store.createReusableAnswer({
      id: id('qa'),
      organizationId: session.org,
      workspaceId: workspace.id,
      questionSlug: slug,
      framework: canonical?.framework ?? 'generic',
      question,
      answer,
      status,
      sourceEvidenceIds,
      updatedBy: session.email,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json({ answer: created, message: 'Reusable answer saved to the library.' });
  }),
);

questionnaireLibraryRouter.get(
  '/questionnaire-library/answers/:id',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const answer = await getStore().getReusableAnswer(req.params.id as string, session.org);
    if (!answer) throw ApiError.notFound('Reusable answer not found.');
    res.json({ answer });
  }),
);

questionnaireLibraryRouter.patch(
  '/questionnaire-library/answers/:id',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const body = requireObjectBody(req.body);
    const store = getStore();
    const existing = await store.getReusableAnswer(req.params.id as string, session.org);
    if (!existing) throw ApiError.notFound('Reusable answer not found.');
    const patch: Partial<ReusableAnswer> = {};
    const answer = optionalString(body.answer, 'answer', 8000);
    if (answer !== undefined) patch.answer = answer;
    const status = optionalEnum(body.status, 'status', ['draft', 'approved'] as const) as ReusableAnswerStatus | undefined;
    if (status) patch.status = status;
    if (Array.isArray(body.sourceEvidenceIds)) {
      patch.sourceEvidenceIds = (body.sourceEvidenceIds as unknown[])
        .filter((value): value is string => typeof value === 'string')
        .slice(0, 20);
    }
    if (Object.keys(patch).length === 0) throw ApiError.badRequest('No supported fields were provided.');
    patch.updatedBy = session.email;
    patch.updatedAt = new Date().toISOString();
    const updated = await store.updateReusableAnswer(existing.id, session.org, patch);
    res.json({ answer: updated });
  }),
);

questionnaireLibraryRouter.delete(
  '/questionnaire-library/answers/:id',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const deleted = await getStore().deleteReusableAnswer(req.params.id as string, session.org);
    if (!deleted) throw ApiError.notFound('Reusable answer not found.');
    res.json({ ok: true, deletedId: req.params.id });
  }),
);

/* ----------------------------- questionnaires --------------------------- */

async function questionnaireDetail(questionnaireId: string, organizationId: string) {
  const store = getStore();
  const questionnaire = await store.getQuestionnaire(questionnaireId, organizationId);
  if (!questionnaire) throw ApiError.notFound('Questionnaire not found.');
  const items = await store.listQuestionnaireItems(questionnaireId, organizationId);
  const answers = await store.listReusableAnswers(organizationId);
  const answerBySlug = new Map(answers.map((answer) => [answer.questionSlug, answer]));
  return {
    questionnaire,
    items: items.map((item) => {
      const suggested = item.questionSlug ? (answerBySlug.get(item.questionSlug) ?? null) : null;
      return { ...item, suggestedAnswer: suggested && item.answerSource === 'none' ? suggested : null };
    }),
    answered: items.filter((item) => item.status === 'answered').length,
    total: items.length,
  };
}

questionnaireLibraryRouter.get(
  '/questionnaire-library/questionnaires',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const store = getStore();
    const items = await store.listQuestionnaires(session.org);
    res.json({
      items: await Promise.all(
        items.map(async (item) => {
          const children = await store.listQuestionnaireItems(item.id, session.org);
          return {
            ...item,
            answered: children.filter((child) => child.status === 'answered').length,
            total: children.length,
          };
        }),
      ),
      total: items.length,
    });
  }),
);

questionnaireLibraryRouter.post(
  '/questionnaire-library/questionnaires',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const body = requireObjectBody(req.body);
    const store = getStore();
    const organization = await store.getOrganization(session.org);
    if (!organization) throw ApiError.notFound('Organisation not found.');
    const workspace = await resolveWorkspace(req, optionalString(body.workspaceId, 'workspaceId', 120));
    const title = requireString(body.title, 'title', { max: 180 });
    const requester = optionalString(body.requester, 'requester', 180) ?? '';
    const now = new Date().toISOString();

    await assertWithinLimit(organization, 'questionnaires');
    const created = await store.createQuestionnaire({
      id: id('qn'),
      organizationId: session.org,
      workspaceId: workspace.id,
      title,
      requester,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json({ questionnaire: created, message: 'Questionnaire created.' });
  }),
);

questionnaireLibraryRouter.get(
  '/questionnaire-library/questionnaires/:id',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    res.json(await questionnaireDetail(req.params.id as string, session.org));
  }),
);

questionnaireLibraryRouter.patch(
  '/questionnaire-library/questionnaires/:id',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const body = requireObjectBody(req.body);
    const store = getStore();
    const existing = await store.getQuestionnaire(req.params.id as string, session.org);
    if (!existing) throw ApiError.notFound('Questionnaire not found.');
    const patch: Record<string, unknown> = {};
    const title = optionalString(body.title, 'title', 180);
    if (title !== undefined) patch.title = title;
    const requester = optionalString(body.requester, 'requester', 180);
    if (requester !== undefined) patch.requester = requester;
    const status = optionalEnum(body.status, 'status', ['draft', 'in_progress', 'completed'] as const) as QuestionnaireStatus | undefined;
    if (status) patch.status = status;
    if (Object.keys(patch).length === 0) throw ApiError.badRequest('No supported fields were provided.');
    patch.updatedAt = new Date().toISOString();
    const updated = await store.updateQuestionnaire(existing.id, session.org, patch as Partial<typeof existing>);
    res.json({ questionnaire: updated });
  }),
);

questionnaireLibraryRouter.delete(
  '/questionnaire-library/questionnaires/:id',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const deleted = await getStore().deleteQuestionnaire(req.params.id as string, session.org);
    if (!deleted) throw ApiError.notFound('Questionnaire not found.');
    res.json({ ok: true, deletedId: req.params.id });
  }),
);

/* --------------------------- questionnaire items ------------------------ */

questionnaireLibraryRouter.post(
  '/questionnaire-library/questionnaires/:id/items',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const body = requireObjectBody(req.body);
    const store = getStore();
    const questionnaire = await store.getQuestionnaire(req.params.id as string, session.org);
    if (!questionnaire) throw ApiError.notFound('Questionnaire not found.');
    const now = new Date().toISOString();

    const questionSlug = optionalString(body.questionSlug, 'questionSlug', 120);
    const canonical = questionSlug ? findCanonicalQuestion(questionSlug) : undefined;
    if (questionSlug && !canonical) throw ApiError.badRequest(`Unknown canonical question slug: ${questionSlug}.`);

    let item: QuestionnaireItem;
    if (canonical) {
      item = {
        id: id('qi'),
        questionnaireId: questionnaire.id,
        organizationId: session.org,
        questionSlug: canonical.slug,
        framework: canonical.framework,
        category: canonical.category,
        question: canonical.question,
        answerSource: 'none',
        reuseConfirmed: false,
        status: 'unanswered',
        createdAt: now,
        updatedAt: now,
      };
    } else {
      const customQuestion = requireString(body.customQuestion, 'customQuestion', { max: 1200 });
      const matched = findCanonicalByText(customQuestion);
      const framework = optionalEnum(body.framework, 'framework', ['soc2', 'iso27001', 'generic'] as const) ?? matched?.framework ?? 'generic';
      item = {
        id: id('qi'),
        questionnaireId: questionnaire.id,
        organizationId: session.org,
        questionSlug: matched?.slug,
        customQuestion,
        framework,
        category: optionalString(body.category, 'category', 120) ?? matched?.category ?? 'General',
        question: customQuestion,
        answerSource: 'none',
        reuseConfirmed: false,
        status: 'unanswered',
        createdAt: now,
        updatedAt: now,
      };
    }

    const created = await store.createQuestionnaireItem(item);
    const suggested = item.questionSlug ? await store.getReusableAnswerBySlug(session.org, item.questionSlug) : null;
    await store.updateQuestionnaire(questionnaire.id, session.org, { updatedAt: now });
    res.status(201).json({
      item: created,
      suggestedAnswer: suggested,
      message: suggested
        ? 'A reusable answer exists for this question. Review it and confirm before it is used — nothing was copied automatically.'
        : 'Question added. No reusable answer exists for it yet.',
    });
  }),
);

questionnaireLibraryRouter.post(
  '/questionnaire-library/questionnaires/:id/items/:itemId/reuse',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const body = requireObjectBody(req.body);
    const store = getStore();
    const item = await store.getQuestionnaireItem(req.params.itemId as string, session.org);
    if (!item || item.questionnaireId !== (req.params.id as string)) throw ApiError.notFound('Questionnaire item not found.');
    // Explicit human confirmation is mandatory — a missing or false confirm
    // must never silently copy a library answer into a questionnaire.
    if (optionalBoolean(body.confirm, 'confirm') !== true) {
      throw ApiError.badRequest('Reuse requires explicit confirmation: send { "confirm": true } after reviewing the suggested answer.');
    }
    const libraryAnswerId = optionalString(body.libraryAnswerId, 'libraryAnswerId', 120);
    const libraryAnswer = libraryAnswerId
      ? await store.getReusableAnswer(libraryAnswerId, session.org)
      : item.questionSlug
        ? await store.getReusableAnswerBySlug(session.org, item.questionSlug)
        : null;
    if (!libraryAnswer) throw ApiError.notFound('No reusable answer exists for this question yet.');
    if (!libraryAnswer.answer.trim()) throw ApiError.badRequest('The reusable answer is empty. Write an answer in the library first.');
    const now = new Date().toISOString();
    const updated = await store.updateQuestionnaireItem(item.id, session.org, {
      answer: libraryAnswer.answer,
      answerSource: 'library',
      reuseConfirmed: true,
      libraryAnswerId: libraryAnswer.id,
      status: 'answered',
      updatedAt: now,
    });
    await store.updateQuestionnaire(item.questionnaireId, session.org, { updatedAt: now });
    res.json({ item: updated, message: 'Library answer reused with your confirmation.' });
  }),
);

questionnaireLibraryRouter.post(
  '/questionnaire-library/questionnaires/:id/items/:itemId/answer',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const body = requireObjectBody(req.body);
    const store = getStore();
    const item = await store.getQuestionnaireItem(req.params.itemId as string, session.org);
    if (!item || item.questionnaireId !== (req.params.id as string)) throw ApiError.notFound('Questionnaire item not found.');
    const answer = requireString(body.answer, 'answer', { max: 8000 });
    const saveToLibrary = optionalBoolean(body.saveToLibrary, 'saveToLibrary') ?? false;
    const now = new Date().toISOString();

    if (saveToLibrary && item.questionSlug) {
      const organization = await store.getOrganization(session.org);
      if (!organization) throw ApiError.notFound('Organisation not found.');
      const questionnaire = await store.getQuestionnaire(item.questionnaireId, session.org);
      const existing = await store.getReusableAnswerBySlug(session.org, item.questionSlug);
      if (existing) {
        await store.updateReusableAnswer(existing.id, session.org, {
          answer,
          status: existing.status,
          updatedBy: session.email,
          updatedAt: now,
        });
      } else {
        await assertWithinLimit(organization, 'reusableAnswers');
        const canonical = findCanonicalQuestion(item.questionSlug);
        await store.createReusableAnswer({
          id: id('qa'),
          organizationId: session.org,
          workspaceId: questionnaire?.workspaceId ?? '',
          questionSlug: item.questionSlug,
          framework: canonical?.framework ?? item.framework,
          question: item.question,
          answer,
          status: 'draft',
          sourceEvidenceIds: [],
          updatedBy: session.email,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const updated = await store.updateQuestionnaireItem(item.id, session.org, {
      answer,
      answerSource: 'custom',
      status: 'answered',
      updatedAt: now,
    });
    await store.updateQuestionnaire(item.questionnaireId, session.org, { updatedAt: now });
    res.json({ item: updated, message: saveToLibrary ? 'Answer saved and added to the reusable library.' : 'Answer saved.' });
  }),
);

questionnaireLibraryRouter.delete(
  '/questionnaire-library/questionnaires/:id/items/:itemId',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const item = await getStore().getQuestionnaireItem(req.params.itemId as string, session.org);
    if (!item || item.questionnaireId !== (req.params.id as string)) throw ApiError.notFound('Questionnaire item not found.');
    await getStore().deleteQuestionnaireItem(item.id, session.org);
    res.json({ ok: true, deletedId: item.id });
  }),
);

/* ------------------------------ export ---------------------------------- */

questionnaireLibraryRouter.get(
  '/questionnaire-library/questionnaires/:id/export',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const format = queryString(req.query.format) ?? 'pdf';
    if (!['pdf', 'csv'].includes(format)) throw ApiError.badRequest('format must be pdf or csv.');
    const store = getStore();
    const detail = await questionnaireDetail(req.params.id as string, session.org);
    const organization = await store.getOrganization(session.org);
    if (!organization) throw ApiError.notFound('Organisation not found.');

    const safeTitle = detail.questionnaire.title.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'questionnaire';
    if (format === 'csv') {
      const lines = [
        ['Question', 'Framework', 'Category', 'Answer', 'Answer source', 'Reuse confirmed'].map(csvCell).join(','),
        ...detail.items.map((item) =>
          [item.question, item.framework, item.category, item.answer ?? '', item.answerSource, item.reuseConfirmed ? 'yes' : 'no']
            .map(csvCell)
            .join(','),
        ),
      ];
      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.setHeader('content-disposition', `attachment; filename="${safeTitle}.csv"`);
      res.send(lines.join('\n'));
      return;
    }

    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `attachment; filename="${safeTitle}.pdf"`);
    res.setHeader('cache-control', 'no-store');
    const pdf = renderQuestionnairePdf({ organization, questionnaire: detail.questionnaire, items: detail.items });
    pdf.on('error', (error: Error) => res.destroy(error));
    pdf.pipe(res);
  }),
);

/* --------------------------- auditor package ---------------------------- */

questionnaireLibraryRouter.get(
  '/questionnaire-library/auditor-package',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const store = getStore();
    const organization = await store.getOrganization(session.org);
    if (!organization) throw ApiError.notFound('Organisation not found.');
    const workspace = await resolveWorkspace(req, queryString(req.query.workspaceId));
    const frameworkKey = optionalEnum(queryString(req.query.framework), 'framework', ['soc2', 'iso27001'] as const) ?? organization.primaryFramework;
    if (!isFrameworkKey(frameworkKey)) throw ApiError.badRequest('Unknown framework.');

    const evidence = await store.listEvidence(session.org, workspace.id);
    const snapshot = snapshotForFramework(frameworkKey, evidence);
    const mappings = mapEvidenceAcrossFrameworks(CONTROL_LIBRARY, evidence);
    const answers = await store.listReusableAnswers(session.org);

    res.setHeader('content-type', 'application/pdf');
    res.setHeader(
      'content-disposition',
      `attachment; filename="auditor-package-${organization.slug}-${frameworkKey}.pdf"`,
    );
    res.setHeader('cache-control', 'no-store');
    const pdf = renderAuditorPackagePdf({
      organization,
      workspace,
      frameworkKey,
      frameworkName: FRAMEWORKS[frameworkKey].name,
      readiness: snapshot.readiness,
      assessments: snapshot.assessments,
      findings: snapshot.findings,
      evidence: evidence.map((doc) => ({
        fileName: doc.fileName,
        category: doc.category,
        status: doc.status,
        mappedControls: mappings.get(doc.id)?.length ?? 0,
        uploadedAt: doc.uploadedAt,
      })),
      answers,
    });
    pdf.on('error', (error: Error) => res.destroy(error));
    pdf.pipe(res);
  }),
);
