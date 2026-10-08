/**
 * Control library, control detail and evidence-to-control mapping routes.
 */
import { Router } from 'express';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import {
  categoryCountsForFramework,
  controlsForFramework,
  getControl,
  getControlByCode,
  RISK_ORDER,
  RISK_LABELS,
} from '../domain/controls.js';
import { FRAMEWORKS, FRAMEWORK_KEYS, isFrameworkKey } from '../domain/frameworks.js';
import { STATUS_LABELS } from '../domain/analysis.js';
import { snapshotForFramework } from '../services/readiness.js';
import { ApiError, asyncHandler } from '../http/errors.js';
import { controlDto, evidenceDto, findingDto } from '../http/dto.js';
import { clampInt, queryString } from '../http/validate.js';
import { getStore } from '../store/index.js';
import { buildFinding } from '../domain/findings.js';
import { resolveWorkspace } from './workspace.js';
import type { ControlStatus, FrameworkKey, MappingEntry, RiskLevel } from '../domain/types.js';

export const controlsRouter = Router();
controlsRouter.use(requireAuth());

const STATUS_FILTERS: ControlStatus[] = ['passed', 'needs_attention', 'missing', 'needs_review'];
const RISK_FILTERS: RiskLevel[] = ['critical', 'high', 'medium', 'low'];

controlsRouter.get(
  '/controls',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const workspace = await resolveWorkspace(
      req,
      typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined,
    );
    const evidence = await store.listEvidence(session.org, workspace.id);

    const frameworkFilter = queryString(req.query.framework);
    const frameworks: FrameworkKey[] =
      frameworkFilter && isFrameworkKey(frameworkFilter)
        ? [frameworkFilter]
        : [...FRAMEWORK_KEYS];

    const statusFilter = queryString(req.query.status) as ControlStatus | undefined;
    const riskFilter = queryString(req.query.risk) as RiskLevel | undefined;
    const categoryFilter = queryString(req.query.category);
    const search = queryString(req.query.search)?.toLowerCase();
    const sort = queryString(req.query.sort) ?? 'priority';
    const limit = clampInt(req.query.limit, 200, 1, 500);

    const items = frameworks.flatMap((key) => {
      const snapshot = snapshotForFramework(key, evidence);
      const findings = new Map(snapshot.findings.map((finding) => [finding.controlId, finding]));
      return snapshot.assessments.map((assessment) =>
        controlDto(assessment, findings.get(assessment.controlId) ?? null),
      );
    });

    let filtered = items;
    if (statusFilter && STATUS_FILTERS.includes(statusFilter)) {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }
    if (riskFilter && RISK_FILTERS.includes(riskFilter)) {
      filtered = filtered.filter((item) => item.riskLevel === riskFilter);
    }
    if (categoryFilter) filtered = filtered.filter((item) => item.category === categoryFilter);
    if (search) {
      filtered = filtered.filter(
        (item) =>
          item.code.toLowerCase().includes(search) ||
          item.name.toLowerCase().includes(search) ||
          item.category.toLowerCase().includes(search),
      );
    }

    const statusOrder: Record<ControlStatus, number> = {
      missing: 0,
      needs_attention: 1,
      needs_review: 2,
      passed: 3,
    };
    filtered.sort((a, b) => {
      if (sort === 'code') return a.code.localeCompare(b.code);
      if (sort === 'risk') {
        return RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel] || a.code.localeCompare(b.code);
      }
      if (sort === 'confidence') return a.confidence - b.confidence || a.code.localeCompare(b.code);
      return (
        statusOrder[a.status] - statusOrder[b.status] ||
        RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel] ||
        a.code.localeCompare(b.code)
      );
    });

    const byFramework = FRAMEWORK_KEYS.filter((key) => frameworks.includes(key)).map((key) => {
      const snapshot = snapshotForFramework(key, evidence);
      return {
        key,
        name: FRAMEWORKS[key].shortName,
        counts: snapshot.readiness.counts,
        readinessIndex: snapshot.readiness.index,
        categories: categoryCountsForFramework(key),
      };
    });

    res.json({
      items: filtered.slice(0, limit),
      total: filtered.length,
      filters: {
        frameworks,
        statuses: STATUS_FILTERS.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
        risks: RISK_FILTERS.map((risk) => ({ value: risk, label: RISK_LABELS[risk] })),
        categories: frameworks.flatMap((key) => categoryCountsForFramework(key)),
      },
      summary: byFramework,
      disclaimer:
        'Control library is a demo dataset for readiness assessment. It is not a licensed reproduction of AICPA or ISO criteria text.',
    });
  }),
);

controlsRouter.get(
  '/controls/:idOrCode',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const workspace = await resolveWorkspace(
      req,
      typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined,
    );
    const identifier = req.params.idOrCode as string;
    const control = getControl(identifier) ?? getControlByCode(identifier);
    if (!control) throw ApiError.notFound('Control not found.');

    const evidence = await store.listEvidence(session.org, workspace.id);
    const snapshot = snapshotForFramework(control.frameworkKey, evidence);
    const assessment = snapshot.assessments.find((item) => item.controlId === control.id);
    if (!assessment) throw ApiError.notFound('Control assessment is unavailable.');

    const finding = buildFinding(assessment, evidence);
    const evidenceById = new Map(evidence.map((doc) => [doc.id, doc]));
    const supportingEvidence = assessment.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
      .map((doc) => evidenceDto(doc, (snapshot.mappings.get(doc.id) ?? []).filter((entry) => entry.controlId === control.id)));

    const related = controlsForFramework(control.frameworkKey)
      .filter((candidate) => candidate.category === control.category && candidate.id !== control.id)
      .slice(0, 6)
      .map((candidate) => {
        const relatedAssessment = snapshot.assessments.find((item) => item.controlId === candidate.id);
        return relatedAssessment
          ? {
              id: candidate.id,
              code: candidate.code,
              name: candidate.name,
              status: relatedAssessment.status,
              statusLabel: STATUS_LABELS[relatedAssessment.status],
            }
          : null;
      })
      .filter(Boolean);

    res.json({
      control: {
        id: control.id,
        code: control.code,
        name: control.name,
        frameworkKey: control.frameworkKey,
        framework: FRAMEWORKS[control.frameworkKey].shortName,
        frameworkVersion: FRAMEWORKS[control.frameworkKey].version,
        category: control.category,
        description: control.description,
        rationale: control.rationale,
        riskLevel: assessment.riskLevel,
        status: assessment.status,
        statusLabel: STATUS_LABELS[assessment.status],
        confidence: assessment.confidence,
        analysisNote: assessment.analysisNote,
        updatedAt: assessment.updatedAt,
        isPolicyDomain: control.isPolicyDomain,
      },
      requirements: control.requiredEvidence.map((item) => ({
        label: item.label,
        satisfied: assessment.matchedItems.includes(item.label),
      })),
      evidenceFound: supportingEvidence,
      evidenceMissing: assessment.missingItems,
      analysis: {
        mode: 'deterministic-mapping',
        note: assessment.analysisNote,
        mappedDocuments: supportingEvidence.length,
        confidence: assessment.confidence,
      },
      finding: finding ? findingDto(finding, evidence) : null,
      recommendation: control.remediation,
      relatedControls: related,
      disclaimer:
        'Readiness assessment only. This control view does not constitute an audit conclusion or certification.',
    });
  }),
);

controlsRouter.get(
  '/mappings',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const workspace = await resolveWorkspace(
      req,
      typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined,
    );
    const evidence = await store.listEvidence(session.org, workspace.id);
    const frameworkFilter = queryString(req.query.framework);
    const frameworks: FrameworkKey[] =
      frameworkFilter && isFrameworkKey(frameworkFilter) ? [frameworkFilter] : [...FRAMEWORK_KEYS];

    const snapshots = frameworks.map((key) => snapshotForFramework(key, evidence));
    const findings = snapshots.flatMap((snapshot) => snapshot.findings);
    const assessments = snapshots.flatMap((snapshot) => snapshot.assessments);

    const documentMappings = new Map<string, MappingEntry[]>();
    for (const snapshot of snapshots) {
      for (const [documentId, entries] of snapshot.mappings) {
        documentMappings.set(documentId, [...(documentMappings.get(documentId) ?? []), ...entries]);
      }
    }

    const documents = evidence
      .filter((doc) => doc.status !== 'analyzing')
      .map((doc) => {
        const linked = [...(documentMappings.get(doc.id) ?? [])].sort(
          (a, b) => b.confidence - a.confidence || a.controlCode.localeCompare(b.controlCode),
        );
        return {
          id: doc.id,
          fileName: doc.fileName,
          category: doc.category,
          status: doc.status,
          summary: doc.summary.slice(0, 160),
          uploadedAt: doc.uploadedAt,
          mappedControls: linked.length,
          controls: linked.map((entry) => ({
            controlId: entry.controlId,
            controlCode: entry.controlCode,
            controlName: entry.controlName,
            frameworkKey: entry.frameworkKey,
            confidence: entry.confidence,
            matchedItems: entry.matchedItems,
            missingItems: entry.missingItems,
          })),
        };
      });

    res.json({
      documents,
      controls: assessments.map((assessment) => ({
        controlId: assessment.controlId,
        controlCode: assessment.controlCode,
        controlName: assessment.name,
        frameworkKey: assessment.frameworkKey,
        category: assessment.category,
        status: assessment.status,
        statusLabel: STATUS_LABELS[assessment.status],
        riskLevel: assessment.riskLevel,
        confidence: assessment.confidence,
        evidenceCount: assessment.evidenceIds.length,
        missingItems: assessment.missingItems,
      })),
      findings: findings.map((finding) => ({
        id: finding.id,
        controlId: finding.controlId,
        controlCode: finding.controlCode,
        title: finding.title,
        riskLevel: finding.riskLevel,
        priority: finding.priority,
      })),
      summary: {
        documents: documents.length,
        mappedDocuments: documents.filter((doc) => doc.mappedControls > 0).length,
        controlsCovered: new Set(assessments.filter((a) => a.evidenceIds.length > 0).map((a) => a.controlId)).size,
        findings: findings.length,
        unmappedDocuments: documents
          .filter((doc) => doc.mappedControls === 0)
          .map((doc) => doc.fileName),
      },
      disclaimer:
        'Mappings are produced by deterministic text matching against the demo control library and are a readiness signal, not an audit conclusion.',
    });
  }),
);
