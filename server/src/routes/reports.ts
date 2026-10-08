/**
 * Readiness report routes: list, generate, inspect and download as PDF.
 *
 * A report is a frozen snapshot of the readiness state at generation time.
 */
import crypto from 'node:crypto';
import { Router } from 'express';
import { requireAuth, sessionOf } from '../auth/middleware.js';
import { writeNarrative, modeLabel } from '../ai/index.js';
import { FRAMEWORKS, isFrameworkKey } from '../domain/frameworks.js';
import { controlsForFramework } from '../domain/controls.js';
import { buildReportRecord, buildReportSummary } from '../domain/reports.js';
import { snapshotForFramework } from '../services/readiness.js';
import { renderReportPdf } from '../pdf/report.js';
import { ApiError, asyncHandler } from '../http/errors.js';
import { reportDto } from '../http/dto.js';
import { optionalEnum, requireObjectBody } from '../http/validate.js';
import { getStore } from '../store/index.js';
import { resolveWorkspace } from './workspace.js';
import type { ReportRecord } from '../domain/types.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth());

async function generateReport(input: {
  organizationId: string;
  workspaceId: string;
  frameworkKey: 'soc2' | 'iso27001';
  requestedBy: string;
  useAiNarrative: boolean;
}): Promise<ReportRecord> {
  const store = getStore();
  const [organization, workspace, evidence] = await Promise.all([
    store.getOrganization(input.organizationId),
    store.getWorkspace(input.workspaceId),
    store.listEvidence(input.organizationId, input.workspaceId),
  ]);
  if (!organization || !workspace) throw ApiError.notFound('Workspace not found.');

  const snapshot = snapshotForFramework(input.frameworkKey, evidence);
  const framework = FRAMEWORKS[input.frameworkKey];

  const narrative = input.useAiNarrative
    ? await writeNarrative({
        companyName: organization.name,
        frameworkName: framework.name,
        readiness: snapshot.readiness,
        findings: snapshot.findings,
        evidenceCount: evidence.length,
        analysisModeLabel: modeLabel(),
      })
    : null;

  const summary = buildReportSummary({
    organization,
    workspace,
    frameworkKey: input.frameworkKey,
    assessments: snapshot.assessments,
    findings: snapshot.findings,
    readiness: snapshot.readiness,
    evidence,
    mappings: snapshot.mappings,
    executiveSummary: narrative?.executiveSummary ?? '',
    themes: narrative?.themes ?? [],
    // Label the report with the mode actually used. If a configured provider
    // failed and the deterministic engine answered, the report says so.
    analysisMode: modeLabel(narrative?.mode),
  });

  const base = buildReportRecord({
    reportId: `rpt-${crypto.randomBytes(6).toString('hex')}`,
    organization,
    workspace,
    frameworkKey: input.frameworkKey,
    assessments: snapshot.assessments,
    findings: snapshot.findings,
    readiness: snapshot.readiness,
    evidence,
    mappings: snapshot.mappings,
    requestedBy: input.requestedBy,
  });

  return store.createReport({ ...base, summary });
}

reportsRouter.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const workspace = await resolveWorkspace(
      req,
      typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined,
    );
    const frameworkFilter = typeof req.query.framework === 'string' ? req.query.framework : undefined;

    let reports = await store.listReports(session.org, workspace.id);

    // The demo workspace always has one sample report available so the report
    // view can be demonstrated end to end without any setup.
    if (reports.length === 0 && workspace.isDemo) {
      await generateReport({
        organizationId: session.org,
        workspaceId: workspace.id,
        frameworkKey: 'soc2',
        requestedBy: 'ComplyLens sample data',
        useAiNarrative: false,
      });
      reports = await store.listReports(session.org, workspace.id);
    }

    const items = reports.filter((report) =>
      frameworkFilter && isFrameworkKey(frameworkFilter)
        ? report.frameworkKey === frameworkFilter
        : true,
    );

    res.json({
      items: items.map((report) => reportDto(report)),
      total: items.length,
      frameworks: Object.values(FRAMEWORKS).map((framework) => ({
        key: framework.key,
        shortName: framework.shortName,
        name: framework.name,
        controlCount: controlsForFramework(framework.key).length,
      })),
      notice:
        'Reports are generated from the evidence currently in the workspace and are stored as snapshots. They are readiness assessments, not certifications.',
    });
  }),
);

reportsRouter.post(
  '/reports',
  asyncHandler(async (req, res) => {
    const session = sessionOf(req);
    const body = requireObjectBody(req.body);
    const workspace = await resolveWorkspace(
      req,
      typeof body.workspaceId === 'string' ? body.workspaceId : undefined,
    );
    const frameworkKey = optionalEnum(body.frameworkKey, 'frameworkKey', ['soc2', 'iso27001'] as const) ?? 'soc2';

    const report = await generateReport({
      organizationId: session.org,
      workspaceId: workspace.id,
      frameworkKey,
      requestedBy: session.email,
      useAiNarrative: true,
    });

    await getStore().recordAuditEvent({
      organizationId: session.org,
      actor: session.email,
      action: 'report.generated',
      target: `${report.name} (${report.fileName})`,
      at: report.generatedAt,
    });

    res.status(201).json({
      report: reportDto(report, { includeSummary: true }),
      message: 'Report generated from the current workspace evidence.',
    });
  }),
);

reportsRouter.get(
  '/reports/:id',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const report = await store.getReport(req.params.id as string, session.org);
    if (!report) throw ApiError.notFound('Report not found.');
    res.json({ report: reportDto(report, { includeSummary: true }) });
  }),
);

reportsRouter.get(
  '/reports/:id/pdf',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const report = await store.getReport(req.params.id as string, session.org);
    if (!report) throw ApiError.notFound('Report not found.');

    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `attachment; filename="${report.fileName}"`);
    res.setHeader('cache-control', 'no-store');

    const pdf = renderReportPdf(report);
    pdf.on('error', (error: Error) => {
      res.destroy(error);
    });
    pdf.pipe(res);
  }),
);

reportsRouter.delete(
  '/reports/:id',
  asyncHandler(async (req, res) => {
    const store = getStore();
    const session = sessionOf(req);
    const report = await store.getReport(req.params.id as string, session.org);
    if (!report) throw ApiError.notFound('Report not found.');

    await store.deleteReport(report.id, session.org);
    await store.recordAuditEvent({
      organizationId: session.org,
      actor: session.email,
      action: 'report.deleted',
      target: report.name,
      at: new Date().toISOString(),
    });

    res.json({ ok: true, deletedId: report.id });
  }),
);
