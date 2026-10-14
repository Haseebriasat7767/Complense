/**
 * Evidence-grounded security questionnaire drafts.
 *
 * This endpoint drafts only from evidence in the authenticated workspace.
 * It never treats an unsupported question as a confirmed security capability.
 */
import { Router } from 'express';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import { ApiError, asyncHandler } from '../http/errors.js';
import { requireObjectBody, optionalString } from '../http/validate.js';
import { getStore } from '../store/index.js';
import { resolveWorkspace } from './workspace.js';

export const questionnaireRouter = Router();
questionnaireRouter.use(requireAuth());

function terms(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])]
    .filter((word) => !['the', 'and', 'for', 'with', 'are', 'does', 'our', 'you', 'your', 'have', 'has', 'how', 'what', 'can', 'that', 'this'].includes(word));
}

questionnaireRouter.post('/questionnaire/draft', asyncHandler(async (req, res) => {
  const body = requireObjectBody(req.body);
  const question = optionalString(body.question, 'question', 1200);
  if (!question || question.trim().length < 8) {
    throw ApiError.badRequest('Provide a security question of at least 8 characters.');
  }

  const session = sessionOf(req);
  const workspace = await resolveWorkspace(req, optionalString(body.workspaceId, 'workspaceId', 120));
  const store = getStore();
  const evidence = await store.listEvidence(session.org, workspace.id);
  const questionTerms = terms(question);

  const ranked = evidence
    .filter((doc) => doc.status === 'analyzed' && doc.content.trim().length > 0)
    .map((doc) => {
      const text = doc.content.toLowerCase();
      const matchedTerms = questionTerms.filter((term) => text.includes(term));
      const score = questionTerms.length ? matchedTerms.length / questionTerms.length : 0;
      return { doc, matchedTerms, score };
    })
    .filter((item) => item.score >= 0.2 && item.matchedTerms.length >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const sources = ranked.map(({ doc, matchedTerms, score }) => {
    const text = doc.content;
    const lower = text.toLowerCase();
    const firstTerm = matchedTerms.find((term) => lower.includes(term)) ?? '';
    const at = lower.indexOf(firstTerm);
    const start = Math.max(0, at - 180);
    const end = Math.min(text.length, Math.max(at + 280, start + 320));
    return {
      evidenceId: doc.id,
      fileName: doc.fileName,
      category: doc.category,
      uploadedAt: doc.uploadedAt,
      matchedTerms,
      relevance: Math.round(score * 100),
      excerpt: text.slice(start, end).trim(),
    };
  });

  const supported = sources.length > 0;
  res.json({
    question: question.trim(),
    status: supported ? 'draft_needs_human_review' : 'unsupported',
    draftAnswer: supported
      ? 'Based on the evidence currently available in this workspace, the following documents may be relevant. Review the cited excerpts and confirm they describe current operating practice before submitting an answer. This draft does not independently verify implementation.'
      : 'No sufficiently relevant, successfully analyzed evidence was found in this workspace. Do not claim the control is implemented based on this result. Request appropriate evidence from the control owner.',
    sources,
    requiresHumanApproval: true,
    disclaimer: 'Draft assistance only. Relevance matching is not proof of control effectiveness, certification, or compliance.',
  });
}));
