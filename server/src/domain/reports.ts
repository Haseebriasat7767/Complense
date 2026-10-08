/**
 * Report snapshots.
 *
 * A report freezes the readiness state at generation time so a downloaded PDF
 * always matches what the workspace showed. Snapshots are stored, not
 * recomputed, which keeps historical comparisons meaningful.
 */
import { FRAMEWORKS, FRAMEWORK_DISCLAIMER } from './frameworks.js';
import { countStatuses } from './scoring.js';
import { demoNarrative } from '../ai/providers/demo.js';
import { modeLabel } from '../ai/index.js';
import type {
  ControlAssessment,
  EvidenceRecord,
  Finding,
  FrameworkKey,
  MappingEntry,
  Organization,
  ReadinessScore,
  ReportRecord,
  ReportSummary,
  Workspace,
} from './types.js';

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${formatDate(iso)} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function buildReportSummary(input: {
  organization: Organization;
  workspace: Workspace;
  frameworkKey: FrameworkKey;
  assessments: ControlAssessment[];
  findings: Finding[];
  readiness: ReadinessScore;
  evidence: EvidenceRecord[];
  mappings: Map<string, MappingEntry[]>;
  executiveSummary: string;
  themes: string[];
  analysisMode: string;
}): ReportSummary {
  const {
    organization,
    frameworkKey,
    assessments,
    findings,
    readiness,
    evidence,
    mappings,
    executiveSummary,
    themes,
    analysisMode,
  } = input;

  const critical = findings.filter((finding) => finding.riskLevel === 'critical');
  const high = findings.filter((finding) => finding.riskLevel === 'high');

  const toRow = (assessment: ControlAssessment, detail: string) => ({
    controlCode: assessment.controlCode,
    name: assessment.name,
    category: assessment.category,
    riskLevel: assessment.riskLevel,
    confidence: assessment.confidence,
    detail,
  });
  const rowComparator = (a: { controlCode: string }, b: { controlCode: string }): number =>
    a.controlCode.localeCompare(b.controlCode);
  const controlsByStatus = {
    passed: assessments
      .filter((assessment) => assessment.status === 'passed')
      .map((assessment) =>
        toRow(assessment, `${assessment.matchedItems.length} of ${assessment.requiredItems.length} expected evidence items supported`),
      )
      .sort(rowComparator),
    needsAttention: assessments
      .filter((assessment) => assessment.status === 'needs_attention')
      .map((assessment) =>
        toRow(
          assessment,
          assessment.missingItems.length > 0 ? `Missing: ${assessment.missingItems.join(', ')}` : 'Partially supported by the submitted evidence',
        ),
      )
      .sort(rowComparator),
    missing: assessments
      .filter((assessment) => assessment.status === 'missing')
      .map((assessment) => toRow(assessment, 'No supporting evidence was submitted for this control'))
      .sort(rowComparator),
    needsReview: assessments
      .filter((assessment) => assessment.status === 'needs_review')
      .map((assessment) => toRow(assessment, 'A submitted document mentions this control but could not be verified automatically'))
      .sort(rowComparator),
  };

  const categoryMap = new Map<string, ReturnType<typeof countStatuses>>();
  for (const assessment of assessments) {
    const bucket = categoryMap.get(assessment.category) ?? {
      total: 0,
      reviewed: 0,
      passed: 0,
      needsAttention: 0,
      missing: 0,
      needsReview: 0,
    };
    const counts = countStatuses([assessment]);
    bucket.total += counts.total;
    bucket.reviewed += counts.reviewed;
    bucket.passed += counts.passed;
    bucket.needsAttention += counts.needsAttention;
    bucket.missing += counts.missing;
    bucket.needsReview += counts.needsReview;
    categoryMap.set(assessment.category, bucket);
  }

  return {
    executiveSummary: [executiveSummary, themes.length ? `Focus areas: ${themes.join(' · ')}.` : '']
      .filter(Boolean)
      .join(' '),
    readiness,
    criticalFindings: critical.map((finding) => ({
      controlCode: finding.controlCode,
      title: finding.title,
      riskLevel: finding.riskLevel,
    })),
    highFindings: high.map((finding) => ({
      controlCode: finding.controlCode,
      title: finding.title,
      riskLevel: finding.riskLevel,
    })),
    recommendations: findings
      .slice(0, 12)
      .map((finding) => ({
        controlCode: finding.controlCode,
        action: finding.recommendation.fix,
        owner: finding.recommendation.owner,
        timelineLabel: finding.recommendation.timelineLabel,
        priority: `${finding.priority} · ${finding.riskLevel.toUpperCase()}`,
      })),
    evidenceInventory: evidence.map((doc) => ({
      fileName: doc.fileName,
      category: doc.category,
      sizeLabel: formatBytes(doc.sizeBytes),
      uploadedAt: doc.uploadedAt,
      status: doc.status,
      mappedControls: (mappings.get(doc.id) ?? []).length,
    })),
    controlsByStatus,
    categoryBreakdown: [...categoryMap.entries()].map(([category, counts]) => ({
      category,
      total: counts.total,
      passed: counts.passed,
      needsAttention: counts.needsAttention,
      missing: counts.missing,
      needsReview: counts.needsReview,
    })),
    conductedBy: `${organization.name} — internal readiness review (Demo Data)`,
    analysisMode,
    disclaimer: `This report is an AI-generated preliminary readiness assessment. It is not a certification, audit opinion, or substitute for professional compliance advice. ${FRAMEWORK_DISCLAIMER}`,
  };
}

export function buildReportRecord(input: {
  reportId: string;
  organization: Organization;
  workspace: Workspace;
  frameworkKey: FrameworkKey;
  assessments: ControlAssessment[];
  findings: Finding[];
  readiness: ReadinessScore;
  evidence: EvidenceRecord[];
  mappings: Map<string, MappingEntry[]>;
  requestedBy: string;
  generatedAt?: string;
}): ReportRecord {
  const {
    reportId,
    organization,
    workspace,
    frameworkKey,
    assessments,
    findings,
    readiness,
    evidence,
    mappings,
    requestedBy,
  } = input;

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const framework = FRAMEWORKS[frameworkKey];

  const narrative = demoNarrative({
    companyName: organization.name,
    frameworkName: framework.name,
    readiness,
    findings,
    evidenceCount: evidence.length,
  });

  const summary = buildReportSummary({
    organization,
    workspace,
    frameworkKey,
    assessments,
    findings,
    readiness,
    evidence,
    mappings,
    executiveSummary: narrative.executiveSummary,
    themes: narrative.themes,
    analysisMode: modeLabel(),
  });

  return {
    id: reportId,
    organizationId: organization.id,
    workspaceId: workspace.id,
    name: `${framework.shortName} Readiness Assessment`,
    frameworkKey,
    companyName: organization.name,
    fileName: `ComplyLens-${framework.shortName.replace(/\s+/g, '')}-Readiness-${generatedAt.slice(0, 10)}.pdf`,
    generatedAt,
    status: 'ready',
    scoreIndex: readiness.index,
    summary,
    requestedBy,
  };
}
