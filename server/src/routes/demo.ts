/**
 * Public demo routes — the seeded AcmeCloud demo workspace, viewable WITHOUT
 * sign-in.
 *
 * This is the trust surface buyers check first: real engine scores computed
 * from the same deterministic pipeline as a signed-in workspace
 * (buildDemoEvidence -> snapshotForFramework), plus a downloadable sample PDF
 * built with the same report generator as paid reports.
 *
 * Everything here is synthetic demo data (see domain/evidence-seed.ts). No
 * user, organisation or workspace data is ever read or returned by these
 * endpoints, and nothing is written. Rate limiting is applied by the global
 * API limiter mounted in app.ts.
 */
import { Router } from 'express';
import { buildDemoEvidence, DEMO_DOCUMENTS, DEMO_WORKSPACE_LABEL } from '../domain/evidence-seed.js';
import { FRAMEWORKS, isFrameworkKey } from '../domain/frameworks.js';
import { buildReportRecord } from '../domain/reports.js';
import { renderReportPdf } from '../pdf/report.js';
import { snapshotForFramework } from '../services/readiness.js';
import { ApiError, asyncHandler } from '../http/errors.js';
import type { EvidenceRecord, FrameworkKey, Organization, Workspace } from '../domain/types.js';

export const demoRouter = Router();

const DEMO_ORG_ID = 'org_acmecloud';
const DEMO_WORKSPACE_ID = 'ws_acmecloud_demo';

/** The demo evidence as real EvidenceRecords, exactly as verify:demo builds them. */
function demoEvidence(): EvidenceRecord[] {
  return buildDemoEvidence(DEMO_ORG_ID, DEMO_WORKSPACE_ID, 'Dana Whitfield').map((input) => ({
    ...input,
    id: input.id as string,
  }));
}

/** Synthetic organisation/workspace shells — only the demo label and ids are real. */
function demoOrg(): Organization {
  return {
    id: DEMO_ORG_ID,
    name: 'AcmeCloud',
    slug: 'acmecloud-demo',
    plan: 'growth',
    primaryFramework: 'soc2',
    industry: 'Software (demo)',
    employeeCount: 42,
    createdAt: '2026-09-12T09:00:00.000Z',
    settings: {
      defaultFramework: 'soc2',
      monthlyDigest: false,
      gapAlerts: false,
      reportReadyEmails: false,
      uploadNotifications: false,
      mfaRequired: false,
      sessionTimeoutMinutes: 30,
      allowedUploadTypes: ['pdf', 'docx', 'txt', 'csv'],
      retentionDays: 365,
    },
  };
}

function demoWorkspace(): Workspace {
  return {
    id: DEMO_WORKSPACE_ID,
    organizationId: DEMO_ORG_ID,
    name: DEMO_WORKSPACE_LABEL,
    isDemo: true,
    isDefault: true,
    createdAt: '2026-09-12T09:00:00.000Z',
    ownerUserId: 'user_demo',
  };
}

function frameworkSummary(key: FrameworkKey) {
  const snapshot = snapshotForFramework(key, demoEvidence());
  const topFindings = [...snapshot.findings]
    .sort((a, b) => a.priority.localeCompare(b.priority))
    .slice(0, 5)
    .map((finding) => ({
      id: finding.id,
      controlCode: finding.controlCode,
      controlName: finding.controlName,
      title: finding.title,
      riskLevel: finding.riskLevel,
      priority: finding.priority,
      recommendation: finding.recommendation.fix,
      timelineLabel: finding.recommendation.timelineLabel,
    }));
  return {
    frameworkKey: key,
    frameworkName: FRAMEWORKS[key].name,
    index: snapshot.readiness.index,
    band: snapshot.readiness.band,
    bandLabel: snapshot.readiness.bandLabel,
    counts: snapshot.readiness.counts,
    openFindings: snapshot.readiness.openFindings,
    methodology: snapshot.readiness.methodology,
    topFindings,
  };
}

demoRouter.get(
  '/readiness',
  asyncHandler(async (_req, res) => {
    res.json({
      demo: true,
      companyName: 'AcmeCloud',
      workspaceLabel: DEMO_WORKSPACE_LABEL,
      note: 'Demo data — a fictional sample workspace. Scores are computed live by the same deterministic engine as signed-in workspaces.',
      generatedAt: new Date().toISOString(),
      frameworks: {
        soc2: frameworkSummary('soc2'),
        iso27001: frameworkSummary('iso27001'),
      },
      documents: DEMO_DOCUMENTS.map((doc) => ({
        fileName: doc.fileName,
        category: doc.category,
        status: doc.status,
        summary: doc.summary,
        uploadedAt: doc.uploadedAt,
      })),
    });
  }),
);

demoRouter.get(
  '/report.pdf',
  asyncHandler(async (req, res) => {
    const frameworkKey = typeof req.query.framework === 'string' ? req.query.framework : 'soc2';
    if (!isFrameworkKey(frameworkKey)) {
      throw ApiError.badRequest('framework must be soc2 or iso27001.');
    }
    const evidence = demoEvidence();
    const snapshot = snapshotForFramework(frameworkKey, evidence);
    const record = buildReportRecord({
      reportId: `rpt-demo-${frameworkKey}`,
      organization: demoOrg(),
      workspace: demoWorkspace(),
      frameworkKey,
      assessments: snapshot.assessments,
      findings: snapshot.findings,
      readiness: snapshot.readiness,
      evidence,
      mappings: snapshot.mappings,
      requestedBy: 'Public demo',
    });
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-disposition', `attachment; filename="${record.fileName}"`);
    res.setHeader('cache-control', 'public, max-age=3600');
    const doc = renderReportPdf(record);
    doc.on('error', (error: Error) => {
      res.destroy(error);
    });
    doc.pipe(res);
  }),
);
