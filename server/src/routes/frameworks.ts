/**
 * Framework readiness routes — the Frameworks page.
 */
import { Router } from 'express';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import { categoryCountsForFramework } from '../domain/controls.js';
import { FRAMEWORKS, FRAMEWORK_KEYS, isFrameworkKey } from '../domain/frameworks.js';
import { countStatuses } from '../domain/scoring.js';
import { snapshotForFramework, evidenceCoverageSummary } from '../services/readiness.js';
import { asyncHandler } from '../http/errors.js';
import { queryString } from '../http/validate.js';
import { getStore } from '../store/index.js';
import { resolveWorkspace } from './workspace.js';

export const frameworksRouter = Router();
frameworksRouter.use(requireAuth());

frameworksRouter.get(
  '/readiness',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const workspace = await resolveWorkspace(
      req,
      typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined,
    );
    const evidence = await store.listEvidence(session.org, workspace.id);
    const requested = queryString(req.query.framework);
    const keys = requested && isFrameworkKey(requested) ? [requested] : [...FRAMEWORK_KEYS];

    const items = keys.map((key) => {
      const snapshot = snapshotForFramework(key, evidence);
      const coverage = evidenceCoverageSummary(evidence, snapshot.mappings);
      const categories = categoryCountsForFramework(key).map((entry) => {
        const scoped = snapshot.assessments.filter((assessment) => assessment.category === entry.category);
        const counts = countStatuses(scoped);
        return {
          category: entry.category,
          controls: entry.count,
          passed: counts.passed,
          needsAttention: counts.needsAttention,
          missing: counts.missing,
          needsReview: counts.needsReview,
        };
      });

      return {
        key,
        name: FRAMEWORKS[key].name,
        shortName: FRAMEWORKS[key].shortName,
        version: FRAMEWORKS[key].version,
        description: FRAMEWORKS[key].description,
        intent: FRAMEWORKS[key].intent,
        readinessLabel: FRAMEWORKS[key].readinessLabel,
        status: evidence.length > 0 ? 'ready-for-demo' : 'awaiting-evidence',
        readinessIndex: snapshot.readiness.index,
        bandLabel: snapshot.readiness.bandLabel,
        counts: snapshot.readiness.counts,
        components: snapshot.readiness.components,
        methodology: snapshot.readiness.methodology,
        controls: snapshot.assessments.length,
        categories,
        coverage: {
          documents: evidence.length,
          documentsMapped: evidence.length - coverage.unmappedDocuments.length,
          distinctControlsCovered: coverage.distinctControlsCovered,
          unmappedDocuments: coverage.unmappedDocuments,
        },
        findings: snapshot.findings.length,
      };
    });

    res.json({
      items,
      workspace: { id: workspace.id, name: workspace.name, isDemo: workspace.isDemo },
      disclaimer:
        'Framework support in this build is a readiness assessment against a demo control library. ComplyLens does not perform certifications or issue audit opinions.',
    });
  }),
);
