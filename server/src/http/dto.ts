/**
 * API DTOs.
 *
 * The wire format is deliberately narrower than the domain model: evidence text
 * is summarised in list responses, password hashes never leave the server, and
 * every payload carries the fields the client actually renders.
 */
import { FRAMEWORKS, FRAMEWORK_DISCLAIMER } from '../domain/frameworks.js';
import { STATUS_LABELS } from '../domain/analysis.js';
import { formatBytes } from '../domain/reports.js';
import type {
  ControlAssessment,
  EvidenceRecord,
  Finding,
  MappingEntry,
  Organization,
  ReportRecord,
  User,
  Workspace,
} from '../domain/types.js';

export function userDto(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    jobTitle: user.jobTitle,
    role: user.role,
    isDemoUser: user.isDemoUser,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

export function organizationDto(organization: Organization) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    plan: organization.plan,
    primaryFramework: organization.primaryFramework,
    industry: organization.industry,
    employeeCount: organization.employeeCount,
    createdAt: organization.createdAt,
    settings: organization.settings,
  };
}

export function workspaceDto(workspace: Workspace) {
  return {
    id: workspace.id,
    name: workspace.name,
    isDemo: workspace.isDemo,
    isDefault: workspace.isDefault,
    createdAt: workspace.createdAt,
    ownerUserId: workspace.ownerUserId,
  };
}

export function evidenceDto(record: EvidenceRecord, mappedControls: MappingEntry[] = []) {
  return {
    id: record.id,
    fileName: record.fileName,
    fileExtension: record.fileExtension,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    sizeLabel: formatBytes(record.sizeBytes),
    category: record.category,
    source: record.source,
    uploadedAt: record.uploadedAt,
    uploadedBy: record.uploadedBy,
    status: record.status,
    frameworkKeys: record.frameworkKeys,
    summary: record.summary,
    mappedControlCount: mappedControls.length,
    mappedControls: mappedControls.slice(0, 8).map((entry) => ({
      controlId: entry.controlId,
      controlCode: entry.controlCode,
      controlName: entry.controlName,
      confidence: entry.confidence,
    })),
    textExcerpt: record.content.slice(0, 280),
  };
}

export function evidenceDetailDto(record: EvidenceRecord, mappedControls: MappingEntry[]) {
  return {
    ...evidenceDto(record, mappedControls),
    extractedText: record.content,
    mapping: mappedControls,
    isDemoSample: record.source === 'demo',
  };
}

export function controlDto(assessment: ControlAssessment, finding: Finding | null) {
  return {
    id: assessment.controlId,
    code: assessment.controlCode,
    frameworkKey: assessment.frameworkKey,
    framework: FRAMEWORKS[assessment.frameworkKey].shortName,
    category: assessment.category,
    name: assessment.name,
    riskLevel: assessment.riskLevel,
    status: assessment.status,
    statusLabel: STATUS_LABELS[assessment.status],
    confidence: assessment.confidence,
    requiredEvidence: assessment.requiredItems.map((item) => item.label),
    matchedEvidence: assessment.matchedItems,
    missingEvidence: assessment.missingItems,
    evidenceCount: assessment.evidenceIds.length,
    analysisNote: assessment.analysisNote,
    updatedAt: assessment.updatedAt,
    findingId: finding?.id ?? null,
    findingTitle: finding?.title ?? null,
    priority: finding?.priority ?? null,
    risk: finding?.riskLevel ?? assessment.riskLevel,
  };
}

export function findingDto(finding: Finding, evidence: EvidenceRecord[]) {
  const byId = new Map(evidence.map((doc) => [doc.id, doc]));
  return {
    ...finding,
    framework: FRAMEWORKS[finding.frameworkKey].shortName,
    evidenceLinks: finding.evidenceFound.map((link) => ({
      ...link,
      status: byId.get(link.evidenceId)?.status ?? 'analyzed',
      category: byId.get(link.evidenceId)?.category ?? 'Uncategorised',
    })),
    guidanceLabel: 'Generated guidance',
  };
}

export function reportDto(report: ReportRecord, options: { includeSummary?: boolean } = {}) {
  const base = {
    id: report.id,
    name: report.name,
    frameworkKey: report.frameworkKey,
    framework: FRAMEWORKS[report.frameworkKey].shortName,
    companyName: report.companyName,
    fileName: report.fileName,
    generatedAt: report.generatedAt,
    status: report.status,
    scoreIndex: report.scoreIndex,
    requestedBy: report.requestedBy,
    downloadUrl: `/api/reports/${report.id}/pdf`,
  };
  return options.includeSummary ? { ...base, summary: report.summary } : base;
}

export const DISCLAIMERS = {
  short: 'Preliminary readiness analysis. Not a certification, audit opinion or legal advice.',
  full: FRAMEWORK_DISCLAIMER,
  report:
    'This report is an AI-generated preliminary readiness assessment. It is not a certification, audit opinion, or substitute for professional compliance advice.',
  demoData:
    'All organisations, users and documents in the sample workspace are fictional demo data.',
};
