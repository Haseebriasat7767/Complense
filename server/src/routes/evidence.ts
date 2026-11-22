/**
 * Evidence routes: upload, list, inspect, re-analyse and delete.
 *
 * Server-side validation covers file type, file size, category and framework
 * selection before any analysis runs.
 */
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import { config } from '../config.js';
import { analyzeEvidence, modeLabel } from '../ai/index.js';
import { categoriesForFramework } from '../domain/controls.js';
import { CONTROL_LIBRARY } from '../domain/controls.js';
import { inferEvidenceCategory } from '../domain/evidence-category.js';
import { FRAMEWORK_KEYS, isFrameworkKey } from '../domain/frameworks.js';
import { mapEvidenceAcrossFrameworks } from '../domain/analysis.js';
import { extractText } from '../services/extract.js';
import { deleteOriginalFile, downloadOriginalFile, uploadOriginalFile } from '../services/original-files.js';
import { logger } from '../logger.js';
import { ApiError, asyncHandler } from '../http/errors.js';
import { evidenceDetailDto, evidenceDto } from '../http/dto.js';
import { optionalString, queryString, requireObjectBody } from '../http/validate.js';
import { getStore } from '../store/index.js';
import { resolveWorkspace } from './workspace.js';
import type { EvidenceRecord, FrameworkKey } from '../domain/types.js';

export const evidenceRouter = Router();
evidenceRouter.use(requireAuth());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).replace('.', '').toLowerCase();
    if (!config.uploads.allowedExtensions.includes(extension)) {
      callback(
        ApiError.unsupportedMedia(
          `Unsupported file type ".${extension}". Allowed: ${config.uploads.allowedExtensions.join(', ').toUpperCase()}.`,
        ),
      );
      return;
    }
    callback(null, true);
  },
});

const ALL_CATEGORIES = [...new Set(CONTROL_LIBRARY.map((control) => control.category))].sort();


function parseCategory(value: unknown, fileName = '', content = ''): string {
  const raw = optionalString(value, 'category', 60);
  if (!raw || /^(un)?categorised$|^(un)?categorized$/i.test(raw)) {
    return inferEvidenceCategory(fileName, content);
  }
  const match = ALL_CATEGORIES.find((category) => category.toLowerCase() === raw.toLowerCase());
  if (!match) {
    throw ApiError.badRequest(`category must be one of: ${ALL_CATEGORIES.join(', ')}.`);
  }
  return match;
}

function parseFrameworks(value: unknown): FrameworkKey[] {
  if (value === undefined || value === null || value === '') return [...FRAMEWORK_KEYS];
  const list = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
  const frameworks = list.filter((entry): entry is FrameworkKey => isFrameworkKey(String(entry)));
  if (frameworks.length === 0) {
    throw ApiError.badRequest('At least one valid framework must be selected.');
  }
  return [...new Set(frameworks)];
}

/**
 * Re-run analysis over already-extracted text without upgrading its extraction
 * status. This endpoint does not retain the original file or run OCR/parsing,
 * so an analysis-only retry cannot claim that extraction improved.
 */
async function refreshAnalysisStatus(record: EvidenceRecord): Promise<EvidenceRecord> {
  const store = getStore();
  const content = record.content.trim();
  const isExtractionFailureNote =
    content.startsWith('[No extractable text:') ||
    content.startsWith('No text layer was found.') ||
    content.startsWith('The file contains no readable text.') ||
    content.startsWith('Files of type .');
  const status: EvidenceRecord['status'] =
    record.status === 'analyzing' ? (content && !isExtractionFailureNote ? 'needs_review' : 'failed') : record.status;
  const analysis =
    status !== 'failed' && content.length > 0
      ? await analyzeEvidence({
          fileName: record.fileName,
          category: record.category,
          content: record.content,
        })
      : null;

  return (
    (await store.updateEvidence(record.id, record.organizationId, {
      status,
      ...(analysis ? { summary: analysis.summary } : {}),
    })) ?? record
  );
}

evidenceRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const workspace = await resolveWorkspace(
      req,
      typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined,
    );
    const statusFilter = queryString(req.query.status);
    const frameworkFilter = queryString(req.query.framework);
    const categoryFilter = queryString(req.query.category);
    const search = queryString(req.query.search)?.toLowerCase();

    let items = await store.listEvidence(session.org, workspace.id);

    // Repair legacy auto-categorised records when the filename gives a clear,
    // more specific category. Explicit user-selected categories are preserved.
    let recategorized = false;
    for (const doc of items) {
      if (doc.category !== 'Incident Response') continue;
      const inferred = inferEvidenceCategory(doc.fileName, doc.content, doc.category);
      if (inferred === doc.category) continue;
      await store.updateEvidence(doc.id, doc.organizationId, { category: inferred });
      recategorized = true;
    }
    if (recategorized) items = await store.listEvidence(session.org, workspace.id);

    // Stale "analyzing" records (e.g. after a restart) are re-derived on read.
    const stale = items.filter(
      (doc) =>
        doc.status === 'analyzing' &&
        doc.uploadedAt !== undefined &&
        Date.now() - new Date(doc.uploadedAt).getTime() > 120_000,
    );
    for (const doc of stale) await refreshAnalysisStatus(doc);
    if (stale.length > 0) items = await store.listEvidence(session.org, workspace.id);

    const mappings = mapEvidenceAcrossFrameworks(CONTROL_LIBRARY, items);

    if (statusFilter) items = items.filter((doc) => doc.status === statusFilter);
    if (frameworkFilter && isFrameworkKey(frameworkFilter)) {
      items = items.filter((doc) => doc.frameworkKeys.includes(frameworkFilter));
    }
    if (categoryFilter) items = items.filter((doc) => doc.category === categoryFilter);
    if (search) {
      items = items.filter(
        (doc) =>
          doc.fileName.toLowerCase().includes(search) ||
          doc.category.toLowerCase().includes(search) ||
          doc.summary.toLowerCase().includes(search),
      );
    }

    res.json({
      items: items.map((doc) => evidenceDto(doc, mappings.get(doc.id) ?? [])),
      total: items.length,
      categories: ALL_CATEGORIES,
      uploads: {
        maxBytes: config.uploads.maxBytes,
        maxLabel: `${Math.round(config.uploads.maxBytes / (1024 * 1024))} MB`,
        allowedExtensions: config.uploads.allowedExtensions,
      },
      analysisMode: { label: modeLabel() },
    });
  }),
);

/** Categories available for the upload form, per framework. */
evidenceRouter.get('/categories', (req, res) => {
  const framework = queryString(req.query.framework);
  const categories =
    framework && isFrameworkKey(framework) ? categoriesForFramework(framework) : ALL_CATEGORIES;
  res.json({ categories, frameworks: FRAMEWORK_KEYS, maxBytes: config.uploads.maxBytes });
});

evidenceRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const record = await store.getEvidence(req.params.id as string, session.org);
    if (!record) throw ApiError.notFound('Evidence not found.');

    const mappings = mapEvidenceAcrossFrameworks(CONTROL_LIBRARY, [record]);
    res.json(evidenceDetailDto(record, mappings.get(record.id) ?? []));
  }),
);

evidenceRouter.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const record = await store.getEvidence(req.params.id as string, session.org);
    if (!record) throw ApiError.notFound('Evidence not found.');
    const prefix = `${session.org}/${record.workspaceId}/`;
    if (!record.sourceRef || !record.sourceRef.startsWith(prefix)) {
      throw ApiError.notFound('The original file is not available for this evidence record.');
    }
    const original = await downloadOriginalFile(record.sourceRef);
    const safeName = path.basename(record.fileName).replace(/[^A-Za-z0-9._-]/g, '_');
    res.setHeader('Content-Type', original.contentType || record.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', original.bytes.length);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(record.fileName)}`);
    res.send(original.bytes);
  }),
);

evidenceRouter.get(
  '/:id/text',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const record = await store.getEvidence(req.params.id as string, session.org);
    if (!record) throw ApiError.notFound('Evidence not found.');

    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('content-disposition', `inline; filename="${record.fileName}.txt"`);
    res.send(
      [
        `ComplyLens AI — extracted text snapshot`,
        `Document: ${record.fileName}`,
        `Category: ${record.category}`,
        `Analysis status: ${record.status}`,
        `Note: this is the extracted text retained for analysis, not the original file.`,
        '',
        record.content,
      ].join('\n'),
    );
  }),
);

evidenceRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const workspace = await resolveWorkspace(
      req,
      typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined,
    );

    const file = req.file;
    if (!file) throw ApiError.badRequest('A file is required (multipart field name: "file").');

    const body = (req.body ?? {}) as Record<string, unknown>;
    const frameworks = parseFrameworks(body.frameworks);

    const extension = path.extname(file.originalname).replace('.', '').toLowerCase();
    const extraction = await extractText({
      buffer: file.buffer,
      extension,
      fileName: file.originalname,
    });
    const category = parseCategory(body.category, file.originalname, extraction.text);

    const analysis = await analyzeEvidence({
      fileName: file.originalname,
      category,
      content: extraction.text,
    });

    const status: EvidenceRecord['status'] =
      extraction.confidence >= 0.8 ? 'analyzed' : extraction.text.length > 0 ? 'needs_review' : 'failed';

    const evidenceId = `ev-${crypto.randomBytes(8).toString('hex')}`;
    const safeFileName = path.basename(file.originalname).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100) || 'evidence';
    const originalPath = `${session.org}/${workspace.id}/${evidenceId}/${safeFileName}`;
    await uploadOriginalFile(originalPath, file.buffer, file.mimetype || 'application/octet-stream');

    let record: EvidenceRecord;
    try {
      record = await store.createEvidence({
      id: evidenceId,
      organizationId: session.org,
      workspaceId: workspace.id,
      fileName: file.originalname.slice(0, 180),
      fileExtension: extension,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: file.size,
      category,
      source: 'upload',
      sourceRef: originalPath,
      uploadedAt: new Date().toISOString(),
      uploadedBy: session.email,
      createdByUser: session.sub,
      status,
      frameworkKeys: frameworks,
      content: extraction.text,
      summary: extraction.text.length > 0 ? analysis.summary : extraction.note,
      });
    } catch (error) {
      await deleteOriginalFile(originalPath).catch(() => undefined);
      throw error;
    }

    await store.recordAuditEvent({
      organizationId: session.org,
      actor: session.email,
      action: 'evidence.uploaded',
      target: record.fileName,
      at: record.uploadedAt,
    });

    const mappings = mapEvidenceAcrossFrameworks(CONTROL_LIBRARY, [record]);
    res.status(201).json({
      evidence: evidenceDto(record, mappings.get(record.id) ?? []),
      extraction: { method: extraction.method, confidence: extraction.confidence, note: extraction.note },
      analysis: { mode: analysis.mode, provider: analysis.provider, keywords: analysis.keywords },
      message:
        status === 'analyzed'
          ? 'Evidence analysed and mapped to controls.'
          : status === 'needs_review'
            ? 'Evidence stored but flagged for manual review — text extraction was incomplete.'
            : 'Evidence stored, but no text could be extracted so it could not be mapped.',
    });
  }),
);

evidenceRouter.post(
  '/:id/analyze',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const record = await store.getEvidence(req.params.id as string, session.org);
    if (!record) throw ApiError.notFound('Evidence not found.');

    // Re-evaluate retained text only. The source file is not retained, so the
    // extraction status must not be promoted by an analysis-only rerun.
    const refreshed = await refreshAnalysisStatus(record);

    await store.recordAuditEvent({
      organizationId: session.org,
      actor: session.email,
      action: refreshed.status === 'analyzed' ? 'evidence.analyzed' : 'evidence.analysis_retried',
      target: record.fileName,
      at: new Date().toISOString(),
    });

    const mappings = mapEvidenceAcrossFrameworks(CONTROL_LIBRARY, [refreshed]);
    res.json({
      evidence: evidenceDto(refreshed, mappings.get(refreshed.id) ?? []),
      message:
        refreshed.status === 'analyzed'
          ? 'Analysis refreshed using the retained text; evidence is mapped to controls.'
          : refreshed.status === 'needs_review'
            ? 'Analysis reran over the retained text; this document remains flagged for manual review.'
            : 'No extractable text is available to analyze. Re-upload a text-based file or an OCR-processed copy.',
    });
  }),
);

evidenceRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const record = await store.getEvidence(req.params.id as string, session.org);
    if (!record) throw ApiError.notFound('Evidence not found.');

    const body = requireObjectBody(req.body);
    const patch: Partial<EvidenceRecord> = {};

    if (body.category !== undefined) patch.category = parseCategory(body.category);
    if (body.frameworks !== undefined) patch.frameworkKeys = parseFrameworks(body.frameworks);
    if (body.summary !== undefined) {
      patch.summary = optionalString(body.summary, 'summary', 400) ?? record.summary;
    }
    if (body.fileName !== undefined) {
      patch.fileName = optionalString(body.fileName, 'fileName', 180) ?? record.fileName;
    }

    if (Object.keys(patch).length === 0) throw ApiError.badRequest('No supported fields were provided.');

    const updated = await store.updateEvidence(record.id, session.org, patch);
    if (!updated) throw ApiError.notFound('Evidence not found.');

    const mappings = mapEvidenceAcrossFrameworks(CONTROL_LIBRARY, [updated]);
    res.json({ evidence: evidenceDto(updated, mappings.get(updated.id) ?? []) });
  }),
);

evidenceRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const record = await store.getEvidence(req.params.id as string, session.org);
    if (!record) throw ApiError.notFound('Evidence not found.');

    await store.deleteEvidence(record.id, session.org);
    let originalFileDeleted = true;
    if (record.sourceRef?.startsWith(`${session.org}/${record.workspaceId}/`)) {
      try {
        await deleteOriginalFile(record.sourceRef);
      } catch (error) {
        originalFileDeleted = false;
        logger.warn('Original evidence file cleanup failed', { evidenceId: record.id });
      }
    }
    await store.recordAuditEvent({
      organizationId: session.org,
      actor: session.email,
      action: 'evidence.deleted',
      target: record.fileName,
      at: new Date().toISOString(),
    });

    res.json({ ok: true, deletedId: record.id, originalFileDeleted, message: `${record.fileName} removed from the workspace.` });
  }),
);
