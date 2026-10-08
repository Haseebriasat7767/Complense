/**
 * Evidence routes: upload, list, inspect, re-analyse and delete.
 *
 * Server-side validation covers file type, file size, category and framework
 * selection before any analysis runs.
 */
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import { config } from '../config.js';
import { analyzeEvidence, modeLabel } from '../ai/index.js';
import { categoriesForFramework } from '../domain/controls.js';
import { CONTROL_LIBRARY } from '../domain/controls.js';
import { FRAMEWORK_KEYS, isFrameworkKey } from '../domain/frameworks.js';
import { mapEvidenceToControls } from '../domain/analysis.js';
import { extractText } from '../services/extract.js';
import { ApiError, asyncHandler } from '../http/errors.js';
import { evidenceDetailDto, evidenceDto } from '../http/dto.js';
import { optionalString, queryString, requireEnum, requireObjectBody } from '../http/validate.js';
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

function parseCategory(value: unknown): string {
  const raw = optionalString(value, 'category', 60);
  if (!raw) return 'Uncategorised';
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

/** Re-derive a document's analysis status from its stored text. */
async function refreshAnalysisStatus(record: EvidenceRecord): Promise<EvidenceRecord> {
  const store = getStore();
  const analysis = await analyzeEvidence({
    fileName: record.fileName,
    category: record.category,
    content: record.content,
  });
  const hasText = record.content.trim().length >= 60;
  const status: EvidenceRecord['status'] = hasText ? 'analyzed' : 'needs_review';
  return (
    (await store.updateEvidence(record.id, record.organizationId, {
      status,
      summary: hasText ? record.summary : analysis.summary,
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

    // Stale "analyzing" records (e.g. after a restart) are re-derived on read.
    const stale = items.filter(
      (doc) =>
        doc.status === 'analyzing' &&
        doc.uploadedAt !== undefined &&
        Date.now() - new Date(doc.uploadedAt).getTime() > 120_000,
    );
    for (const doc of stale) await refreshAnalysisStatus(doc);
    if (stale.length > 0) items = await store.listEvidence(session.org, workspace.id);

    const controls = CONTROL_LIBRARY;
    const mappings = mapEvidenceToControls(controls, items, 'soc2');

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

    const mappings = mapEvidenceToControls(CONTROL_LIBRARY, [record], 'soc2');
    res.json(evidenceDetailDto(record, mappings.get(record.id) ?? []));
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
    const category = parseCategory(body.category);
    const frameworks = parseFrameworks(body.frameworks);

    const extension = path.extname(file.originalname).replace('.', '').toLowerCase();
    const extraction = extractText({
      buffer: file.buffer,
      extension,
      fileName: file.originalname,
    });

    const analysis = await analyzeEvidence({
      fileName: file.originalname,
      category,
      content: extraction.text,
    });

    const status: EvidenceRecord['status'] =
      extraction.confidence >= 0.8 ? 'analyzed' : extraction.text.length > 0 ? 'needs_review' : 'failed';

    const record = await store.createEvidence({
      organizationId: session.org,
      workspaceId: workspace.id,
      fileName: file.originalname.slice(0, 180),
      fileExtension: extension,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: file.size,
      category,
      source: 'upload',
      uploadedAt: new Date().toISOString(),
      uploadedBy: session.email,
      status,
      frameworkKeys: frameworks,
      content: extraction.text || extraction.note,
      summary: extraction.text.length > 0 ? analysis.summary : extraction.note,
    });

    await store.recordAuditEvent({
      organizationId: session.org,
      actor: session.email,
      action: 'evidence.uploaded',
      target: record.fileName,
      at: record.uploadedAt,
    });

    const mappings = mapEvidenceToControls(CONTROL_LIBRARY, [record], 'soc2');
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

    // Surface the transient "analyzing" state, then settle deterministically.
    await store.updateEvidence(record.id, session.org, { status: 'analyzing' });
    const refreshed = await refreshAnalysisStatus(record);

    await store.recordAuditEvent({
      organizationId: session.org,
      actor: session.email,
      action: 'evidence.analyzed',
      target: record.fileName,
      at: new Date().toISOString(),
    });

    const mappings = mapEvidenceToControls(CONTROL_LIBRARY, [refreshed], 'soc2');
    res.json({
      evidence: evidenceDto(refreshed, mappings.get(refreshed.id) ?? []),
      message:
        refreshed.status === 'analyzed'
          ? 'Analysis complete — evidence mapped to controls.'
          : 'Analysis complete, but the document still needs manual review because its text could not be read reliably.',
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
    if (body.status !== undefined) {
      patch.status = requireEnum(body.status, 'status', [
        'analyzed',
        'analyzing',
        'needs_review',
        'failed',
      ] as const);
    }
    if (body.summary !== undefined) {
      patch.summary = optionalString(body.summary, 'summary', 400) ?? record.summary;
    }
    if (body.fileName !== undefined) {
      patch.fileName = optionalString(body.fileName, 'fileName', 180) ?? record.fileName;
    }

    if (Object.keys(patch).length === 0) throw ApiError.badRequest('No supported fields were provided.');

    const updated = await store.updateEvidence(record.id, session.org, patch);
    if (!updated) throw ApiError.notFound('Evidence not found.');

    const mappings = mapEvidenceToControls(CONTROL_LIBRARY, [updated], 'soc2');
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
    await store.recordAuditEvent({
      organizationId: session.org,
      actor: session.email,
      action: 'evidence.deleted',
      target: record.fileName,
      at: new Date().toISOString(),
    });

    res.json({ ok: true, deletedId: record.id, message: `${record.fileName} removed from the workspace.` });
  }),
);
