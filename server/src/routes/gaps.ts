/**
 * Gap analysis and remediation routes.
 */
import { Router } from 'express';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import { RISK_ORDER } from '../domain/controls.js';
import { FRAMEWORKS, FRAMEWORK_KEYS, isFrameworkKey } from '../domain/frameworks.js';
import { findingRatings } from '../domain/findings.js';
import { snapshotForFramework } from '../services/readiness.js';
import { asyncHandler } from '../http/errors.js';
import { findingDto } from '../http/dto.js';
import { clampInt, queryString } from '../http/validate.js';
import { getStore } from '../store/index.js';
import { resolveWorkspace } from './workspace.js';
import type { ControlStatus, FrameworkKey, RiskLevel } from '../domain/types.js';

export const gapsRouter = Router();
gapsRouter.use(requireAuth());

const RISK_FILTERS: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
const STATUS_FILTERS: ControlStatus[] = ['passed', 'needs_attention', 'missing', 'needs_review'];

gapsRouter.get(
  '/gaps',
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
    const allFindings = snapshots.flatMap((snapshot) => snapshot.findings);

    const riskFilter = queryString(req.query.risk) as RiskLevel | undefined;
    const statusFilter = queryString(req.query.status) as ControlStatus | undefined;
    const categoryFilter = queryString(req.query.category);
    const priorityFilter = queryString(req.query.priority);
    const ownerFilter = queryString(req.query.owner);
    const search = queryString(req.query.search)?.toLowerCase();
    const sort = queryString(req.query.sort) ?? 'severity';

    let items = allFindings;
    if (riskFilter && RISK_FILTERS.includes(riskFilter)) {
      items = items.filter((finding) => finding.riskLevel === riskFilter);
    }
    if (statusFilter && STATUS_FILTERS.includes(statusFilter)) {
      items = items.filter((finding) => finding.controlStatus === statusFilter);
    }
    if (categoryFilter) items = items.filter((finding) => finding.category === categoryFilter);
    if (priorityFilter) items = items.filter((finding) => finding.priority === priorityFilter);
    if (ownerFilter) {
      items = items.filter((finding) => finding.recommendation.owner === ownerFilter);
    }
    if (search) {
      items = items.filter(
        (finding) =>
          finding.controlCode.toLowerCase().includes(search) ||
          finding.title.toLowerCase().includes(search) ||
          finding.finding.toLowerCase().includes(search),
      );
    }

    items = [...items].sort((a, b) => {
      if (sort === 'control') return a.controlCode.localeCompare(b.controlCode);
      if (sort === 'owner') return a.recommendation.owner.localeCompare(b.recommendation.owner);
      if (sort === 'timeline') return a.recommendation.timelineDays - b.recommendation.timelineDays;
      if (sort === 'category') return a.category.localeCompare(b.category);
      return (
        RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel] ||
        a.controlCode.localeCompare(b.controlCode)
      );
    });

    const limit = clampInt(req.query.limit, 200, 1, 500);
    const categories = [...new Set(allFindings.map((finding) => finding.category))].sort();
    const owners = [...new Set(allFindings.map((finding) => finding.recommendation.owner))].sort();

    res.json({
      items: items.slice(0, limit).map((finding) => findingDto(finding, evidence)),
      total: items.length,
      ratings: findingRatings(allFindings),
      summary: {
        byRisk: RISK_FILTERS.map((risk) => ({
          risk,
          count: allFindings.filter((finding) => finding.riskLevel === risk).length,
        })),
        byFramework: frameworks.map((key) => ({
          key,
          name: FRAMEWORKS[key].shortName,
          findings: allFindings.filter((finding) => finding.frameworkKey === key).length,
          readinessIndex:
            snapshots.find((snapshot) => snapshot.frameworkKey === key)?.readiness.index ?? 0,
        })),
        firstWave: items.filter((finding) => finding.riskLevel === 'critical' || finding.riskLevel === 'high').length,
        categories,
        owners,
      },
      filters: {
        risks: RISK_FILTERS,
        statuses: STATUS_FILTERS,
        frameworks,
        categories,
        owners,
        priorities: ['P1', 'P2', 'P3', 'P4'],
      },
      guidanceNotice:
        'Recommended fixes, owners and timelines are generated guidance from the ComplyLens analysis layer. Validate them against your operating model before committing to dates.',
    });
  }),
);

gapsRouter.get(
  '/findings/:id',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const workspace = await resolveWorkspace(
      req,
      typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined,
    );
    const evidence = await store.listEvidence(session.org, workspace.id);

    const identifier = req.params.id as string;
    for (const key of FRAMEWORK_KEYS) {
      const snapshot = snapshotForFramework(key, evidence);
      const finding = snapshot.findings.find(
        (item) => item.id === identifier || item.controlId === identifier || item.controlCode === identifier,
      );
      if (finding) {
        res.json({
          finding: findingDto(finding, evidence),
          guidanceNotice:
            'Recommended fixes, owners and timelines are generated guidance and should be validated by the control owner.',
        });
        return;
      }
    }
    res.status(404).json({ error: { code: 'not_found', message: 'Finding not found.' } });
  }),
);
