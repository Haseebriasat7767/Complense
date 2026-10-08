/**
 * Workspace routes: current context, dashboard aggregate, activity feed and
 * organisation/workspace settings.
 *
 * Every query is scoped to the organisation carried in the session token.
 */
import type { Request } from 'express';
import { Router } from 'express';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import { config, analysisMode } from '../config.js';
import { FRAMEWORKS, FRAMEWORK_KEYS, isFrameworkKey } from '../domain/frameworks.js';
import { countStatuses } from '../domain/scoring.js';
import { findingRatings } from '../domain/findings.js';
import { evidenceCoverageSummary, snapshotForFramework } from '../services/readiness.js';
import { ApiError, asyncHandler } from '../http/errors.js';
import { controlDto, evidenceDto, findingDto, organizationDto, workspaceDto } from '../http/dto.js';
import { modeLabel } from '../ai/index.js';
import { optionalBoolean, optionalEnum, optionalString, requireObjectBody, clampInt } from '../http/validate.js';
import { getStore } from '../store/index.js';
import type { FrameworkKey, Workspace } from '../domain/types.js';

export const workspaceRouter = Router();
workspaceRouter.use(requireAuth());

export async function resolveWorkspace(req: Request, requestedId?: string): Promise<Workspace> {
  const session = sessionOf(req);
  const store = getStore();
  const workspaces = await store.listWorkspaces(session.org);
  if (workspaces.length === 0) throw ApiError.notFound('No workspace is available for this organisation.');

  if (requestedId) {
    const match = workspaces.find((workspace) => workspace.id === requestedId);
    if (!match) throw ApiError.notFound('Workspace not found in your organisation.');
    return match;
  }
  return workspaces.find((workspace) => workspace.isDefault) ?? (workspaces[0] as Workspace);
}

export function requestedFramework(req: Request, fallback: FrameworkKey): FrameworkKey {
  const raw = typeof req.query.framework === 'string' ? req.query.framework : undefined;
  if (raw && isFrameworkKey(raw)) return raw;
  return fallback;
}

function greeting(): { period: string; label: string } {
  const hour = new Date().getUTCHours();
  const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return { period, label: `Good ${period}` };
}

workspaceRouter.get(
  '/context',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const store = getStore();
    const [user, organization, workspaces] = await Promise.all([
      store.getUserById(session.sub),
      store.getOrganization(session.org),
      store.listWorkspaces(session.org),
    ]);
    if (!organization) throw ApiError.notFound('Organisation not found.');
    const workspace = await resolveWorkspace(req);
    res.json({
      user: user ? { id: user.id, name: user.name, email: user.email, jobTitle: user.jobTitle, role: user.role, isDemoUser: user.isDemoUser } : null,
      organization: organizationDto(organization),
      workspace: workspaceDto(workspace),
      workspaces: workspaces.map(workspaceDto),
      demoMode: config.demoMode,
      analysisMode: { key: analysisMode(), label: modeLabel() },
    });
  }),
);

workspaceRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const organization = await store.getOrganization(session.org);
    if (!organization) throw ApiError.notFound('Organisation not found.');

    const workspace = await resolveWorkspace(req, typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined);
    const evidence = await store.listEvidence(session.org, workspace.id);
    const primaryKey = requestedFramework(req, organization.primaryFramework);

    const snapshots = new Map(
      FRAMEWORK_KEYS.map((key) => [key, snapshotForFramework(key, evidence)]),
    );
    const primary = snapshots.get(primaryKey);
    if (!primary) throw ApiError.badRequest('Unknown framework.');
    const coverage = evidenceCoverageSummary(evidence, primary.mappings);

    const findingById = new Map(primary.findings.map((finding) => [finding.id, finding]));

    const categories = [...new Set(primary.assessments.map((assessment) => assessment.category))]
      .map((category) => {
        const scoped = primary.assessments.filter((assessment) => assessment.category === category);
        const counts = countStatuses(scoped);
        return {
          category,
          total: counts.total,
          passed: counts.passed,
          needsAttention: counts.needsAttention,
          missing: counts.missing,
          needsReview: counts.needsReview,
        };
      })
      .sort((a, b) => b.missing - a.missing || b.needsAttention - a.needsAttention || a.category.localeCompare(b.category));

    const activity = buildActivity(evidence.slice(0, 6), primary.findings.length, workspace);

    res.json({
      workspace: workspaceDto(workspace),
      organization: organizationDto(organization),
      greeting: { ...greeting(), name: organization.name },
      generatedAt: primary.assessments[0]?.updatedAt ?? new Date().toISOString(),
      analysisMode: { key: analysisMode(), label: modeLabel() },
      framework: {
        key: primaryKey,
        name: FRAMEWORKS[primaryKey].name,
        shortName: FRAMEWORKS[primaryKey].shortName,
      },
      metric: {
        readinessIndex: primary.readiness.index,
        bandLabel: primary.readiness.bandLabel,
        components: primary.readiness.components,
        methodology: primary.readiness.methodology,
      },
      counts: primary.readiness.counts,
      findings: findingRatings(primary.findings),
      frameworks: FRAMEWORK_KEYS.map((key) => {
        const snapshot = snapshots.get(key);
        return {
          key,
          name: FRAMEWORKS[key].name,
          shortName: FRAMEWORKS[key].shortName,
          readinessIndex: snapshot?.readiness.index ?? 0,
          bandLabel: snapshot?.readiness.bandLabel ?? 'Not started',
          counts: snapshot?.readiness.counts ?? countStatuses([]),
          readinessLabel: FRAMEWORKS[key].readinessLabel,
        };
      }),
      priorityFindings: primary.findings.slice(0, 5).map((finding) => findingDto(finding, evidence)),
      recentEvidence: evidence
        .slice(0, 5)
        .map((doc) => evidenceDto(doc, primary.mappings.get(doc.id) ?? [])),
      coverage: {
        ...coverage,
        documentsWithFindings: primary.findings.reduce(
          (sum, finding) => sum + finding.evidenceFound.length,
          0,
        ),
      },
      categories,
      topControl: controlDto(
        primary.assessments.find((assessment) => assessment.status === 'missing') ??
          primary.assessments[0]!,
        findingById.get(primary.findings[0]?.id ?? '') ?? null,
      ),
      activity,
    });
  }),
);

workspaceRouter.get(
  '/activity',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const workspace = await resolveWorkspace(req);
    const evidence = await store.listEvidence(session.org, workspace.id);
    const reports = await store.listReports(session.org, workspace.id);
    const limit = clampInt(req.query.limit, 20, 1, 50);

    const events = [
      ...evidence.map((doc) => ({
        id: `ev-${doc.id}`,
        type: doc.status === 'analyzed' ? 'analysis' : doc.status === 'failed' ? 'error' : 'upload',
        label:
          doc.status === 'analyzed'
            ? `${doc.fileName} analysed`
            : doc.status === 'failed'
              ? `${doc.fileName} could not be analysed`
              : `${doc.fileName} uploaded`,
        detail: doc.summary.slice(0, 160),
        at: doc.uploadedAt,
      })),
      ...reports.map((report) => ({
        id: `rep-${report.id}`,
        type: 'report',
        label: `${report.name} generated`,
        detail: `Readiness index ${report.scoreIndex}% · ${report.fileName}`,
        at: report.generatedAt,
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);

    res.json({ items: events, total: events.length });
  }),
);

function buildActivity(
  evidence: Awaited<ReturnType<ReturnType<typeof getStore>['listEvidence']>>,
  findingCount: number,
  workspace: Workspace,
) {
  const items = evidence.map((doc) => ({
    id: `act-${doc.id}`,
    at: doc.uploadedAt,
    label:
      doc.status === 'analyzed'
        ? `Analysed ${doc.fileName}`
        : doc.status === 'failed'
          ? `Analysis failed for ${doc.fileName}`
          : `Uploaded ${doc.fileName}`,
    detail:
      doc.status === 'analyzed'
        ? `${doc.category} · mapped to controls`
        : doc.status === 'failed'
          ? 'No extractable text — re-upload or run OCR'
          : `${doc.category} · awaiting review`,
    type: doc.status === 'failed' ? 'error' : 'evidence',
  }));
  return {
    workspaceName: workspace.name,
    openFindings: findingCount,
    items,
  };
}

workspaceRouter.patch(
  '/organization',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const body = requireObjectBody(req.body);
    const organization = await store.getOrganization(session.org);
    if (!organization) throw ApiError.notFound('Organisation not found.');
    if (session.role !== 'owner' && session.role !== 'admin') {
      throw ApiError.forbidden('Only organisation owners and admins can change these settings.');
    }

    const settings = { ...organization.settings };
    const settingsPatch = body.settings as Record<string, unknown> | undefined;
    if (settingsPatch && typeof settingsPatch === 'object') {
      const booleanKeys = [
        'monthlyDigest',
        'gapAlerts',
        'reportReadyEmails',
        'uploadNotifications',
        'mfaRequired',
      ] as const;
      for (const key of booleanKeys) {
        const value = optionalBoolean(settingsPatch[key], `settings.${key}`);
        if (value !== undefined) settings[key] = value;
      }
      const framework = optionalEnum(settingsPatch.defaultFramework, 'settings.defaultFramework', FRAMEWORK_KEYS);
      if (framework) settings.defaultFramework = framework;
      if (settingsPatch.sessionTimeoutMinutes !== undefined) {
        settings.sessionTimeoutMinutes = clampInt(settingsPatch.sessionTimeoutMinutes, 30, 5, 480);
      }
      if (settingsPatch.retentionDays !== undefined) {
        settings.retentionDays = clampInt(settingsPatch.retentionDays, 365, 30, 2555);
      }
      if (Array.isArray(settingsPatch.allowedUploadTypes)) {
        settings.allowedUploadTypes = settingsPatch.allowedUploadTypes
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.replace(/^\./, '').toLowerCase())
          .filter((value) => config.uploads.allowedExtensions.includes(value));
      }
    }

    const updated = await store.updateOrganization(session.org, {
      name: optionalString(body.name, 'name', 120) ?? organization.name,
      industry: optionalString(body.industry, 'industry', 120) ?? organization.industry,
      employeeCount:
        body.employeeCount === undefined ? organization.employeeCount : clampInt(body.employeeCount, organization.employeeCount, 0, 100000),
      primaryFramework:
        optionalEnum(body.primaryFramework, 'primaryFramework', FRAMEWORK_KEYS) ?? organization.primaryFramework,
      settings,
    });

    await store.recordAuditEvent({
      organizationId: session.org,
      actor: session.email,
      action: 'organization.updated',
      target: updated?.name ?? organization.name,
      at: new Date().toISOString(),
    });

    res.json({ organization: organizationDto(updated ?? organization) });
  }),
);

workspaceRouter.patch(
  '/workspace',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const body = requireObjectBody(req.body);
    const workspace = await resolveWorkspace(req);
    const name = optionalString(body.name, 'name', 80);
    if (!name) throw ApiError.badRequest('A workspace name is required.');

    const updated =
      (await store.updateWorkspace(workspace.id, { name })) ?? workspace;

    await store.recordAuditEvent({
      organizationId: session.org,
      actor: session.email,
      action: 'workspace.renamed',
      target: updated.name,
      at: new Date().toISOString(),
    });

    res.json({ workspace: workspaceDto(updated) });
  }),
);
