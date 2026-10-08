/**
 * Findings and remediation guidance.
 *
 * A finding is raised for every control that is not fully evidenced:
 *   missing          → escalated one risk level (nothing to work with)
 *   needs_attention  → control risk level (partial evidence)
 *   needs_review     → reduced one risk level (mentioned but unsubstantiated)
 *
 * Recommendations are guidance produced by the analysis layer. In demo mode the
 * guidance comes from the deterministic rule set in the control library, which
 * is why it is labelled "generated guidance" rather than an audit conclusion.
 */
import { getControl, RISK_ORDER } from './controls.js';
import type {
  ControlAssessment,
  EvidenceRecord,
  Finding,
  RiskLevel,
} from './types.js';

const RISK_DOWNGRADE: Record<RiskLevel, RiskLevel> = {
  critical: 'high',
  high: 'medium',
  medium: 'low',
  low: 'low',
};

const RISK_UPGRADE: Record<RiskLevel, RiskLevel> = {
  critical: 'critical',
  high: 'critical',
  medium: 'high',
  low: 'medium',
};

export const PRIORITY_BY_RISK: Record<RiskLevel, Finding['priority']> = {
  critical: 'P1',
  high: 'P2',
  medium: 'P3',
  low: 'P4',
};

const PRIORITY_NOTE: Record<RiskLevel, string> = {
  critical:
    'No supporting evidence exists for this control. Treat as the first remediation wave before an audit window opens.',
  high: 'High-impact gap. Evidence is incomplete for a control auditors usually sample heavily.',
  medium:
    'Moderate impact. Closing this gap strengthens the control narrative and reduces follow-up questions.',
  low: 'Low impact. Worth documenting, but do not delay higher-risk remediation to complete it.',
};

export function findingSeverity(riskLevel: RiskLevel, status: ControlAssessment['status']): RiskLevel {
  if (status === 'missing') return RISK_UPGRADE[riskLevel];
  if (status === 'needs_review') return RISK_DOWNGRADE[riskLevel];
  return riskLevel;
}

export function buildFinding(
  assessment: ControlAssessment,
  evidence: EvidenceRecord[],
): Finding | null {
  if (assessment.status === 'passed') return null;

  const control = getControl(assessment.controlId);
  if (!control) return null;

  const severity = findingSeverity(control.riskLevel, assessment.status);
  const missing = assessment.missingItems;
  const primaryMissing = missing[0] ?? 'Expected evidence';
  const evidenceById = new Map(evidence.map((doc) => [doc.id, doc]));
  const evidenceFound = assessment.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((doc): doc is EvidenceRecord => Boolean(doc))
    .map((doc) => ({ evidenceId: doc.id, fileName: doc.fileName }));

  return {
    id: `find-${control.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    controlId: control.id,
    controlCode: control.code,
    controlName: control.name,
    frameworkKey: control.frameworkKey,
    category: control.category,
    riskLevel: severity,
    priority: PRIORITY_BY_RISK[severity],
    status: 'open',
    title: findingTitle(control.name, assessment.status, primaryMissing),
    finding: findingText(assessment, evidenceFound.length),
    evidenceFound,
    evidenceMissing: missing,
    recommendation: {
      fix: control.remediation.fix,
      owner: control.remediation.owner,
      timelineDays: control.remediation.timelineDays,
      timelineLabel: timelineLabel(control.remediation.timelineDays),
      priorityNote: PRIORITY_NOTE[severity],
    },
    aiGenerated: true,
    detectedAt: assessment.updatedAt,
    controlStatus: assessment.status,
  };
}

function findingTitle(
  controlName: string,
  status: ControlAssessment['status'],
  primaryMissing: string,
): string {
  if (status === 'missing') return `${controlName} — no evidence submitted`;
  if (status === 'needs_review') return `${primaryMissing} referenced but not evidenced`;
  return `${primaryMissing} evidence missing`;
}

function findingText(assessment: ControlAssessment, documentCount: number): string {
  const total = assessment.requiredItems.length;
  const matched = assessment.matchedItems.length;

  if (assessment.status === 'missing') {
    return `None of the ${total} expected evidence item${total === 1 ? '' : 's'} for this control could be located in the workspace. Required: ${assessment.missingItems.join('; ')}.`;
  }
  if (assessment.status === 'needs_review') {
    return `Uploaded material references this topic, but no source document substantiates ${assessment.missingItems.join('; ')}. The evidence for this control is unverified or incomplete.`;
  }
  const missing = assessment.missingItems.join('; ');
  return `${matched} of ${total} expected evidence item${total === 1 ? '' : 's'} are supported${documentCount > 0 ? ` by ${documentCount} document${documentCount === 1 ? '' : 's'}` : ''}. Outstanding: ${missing}.`;
}

export function timelineLabel(days: number): string {
  if (days <= 14) return `${days} days (immediate)`;
  if (days <= 31) return `${days} days`;
  if (days <= 62) return `${days} days (one quarter)`;
  return `${days} days (two quarters)`;
}

export function buildFindings(
  assessments: ControlAssessment[],
  evidence: EvidenceRecord[],
): Finding[] {
  return assessments
    .map((assessment) => buildFinding(assessment, evidence))
    .filter((finding): finding is Finding => Boolean(finding))
    .sort(
      (a, b) =>
        RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel] ||
        a.controlCode.localeCompare(b.controlCode),
    );
}

export function findingRatings(findings: Finding[]) {
  return {
    critical: findings.filter((f) => f.riskLevel === 'critical').length,
    high: findings.filter((f) => f.riskLevel === 'high').length,
    medium: findings.filter((f) => f.riskLevel === 'medium').length,
    low: findings.filter((f) => f.riskLevel === 'low').length,
    total: findings.length,
  };
}
