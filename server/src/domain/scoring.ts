/**
 * Readiness index.
 *
 * The index is a transparent weighted composite — not a black box and not an
 * audit opinion. Every component is derived from the same deterministic
 * analysis a user can inspect in the workspace:
 *
 *   control health        28%  status-weighted credit across reviewed controls
 *   evidence coverage     35%  reviewed controls that map to at least one document
 *   evidence depth        12%  required evidence items satisfied per evidenced control
 *   remediation planning  25%  open findings that carry an owner and a timeline
 *
 * Reference points from the seeded demo workspace (Demo Data):
 *   SOC 2      -> 92   ISO 27001 -> 78
 */
import { STATUS_CREDIT } from './analysis.js';
import type {
  ControlAssessment,
  ControlDefinition,
  Finding,
  FrameworkKey,
  ReadinessComponent,
  ReadinessScore,
} from './types.js';

export const SCORE_WEIGHTS: Record<ReadinessComponent['key'], number> = {
  controlHealth: 0.28,
  evidenceCoverage: 0.35,
  evidenceDepth: 0.12,
  remediationCoverage: 0.25,
};

export const SCORE_METHODOLOGY =
  'Weighted readiness index — control health 28%, evidence coverage 35%, evidence depth 12%, remediation planning 25%.';

export function scoreBand(index: number): { band: ReadinessScore['band']; label: string } {
  if (index >= 85) return { band: 'strong', label: 'Strong readiness' };
  if (index >= 70) return { band: 'moderate', label: 'Moderate readiness' };
  if (index >= 50) return { band: 'at_risk', label: 'At risk' };
  return { band: 'critical', label: 'Critical gaps' };
}

/** A control is "reviewed" once evidence has been submitted for it. */
export function isReviewed(assessment: ControlAssessment): boolean {
  return assessment.status !== 'needs_review';
}

export function countStatuses(assessments: ControlAssessment[]) {
  const total = assessments.length;
  const needsReview = assessments.filter((a) => a.status === 'needs_review').length;
  return {
    total,
    reviewed: total - needsReview,
    passed: assessments.filter((a) => a.status === 'passed').length,
    needsAttention: assessments.filter((a) => a.status === 'needs_attention').length,
    missing: assessments.filter((a) => a.status === 'missing').length,
    needsReview,
  };
}

export function computeReadiness(input: {
  assessments: ControlAssessment[];
  controls?: ControlDefinition[];
  findings: Finding[];
}): ReadinessScore {
  const { assessments, findings } = input;
  const counts = countStatuses(assessments);
  const reviewed = assessments.filter(isReviewed);

  // 1. Control health — status-weighted credit.
  const credit = reviewed.reduce((sum, assessment) => sum + STATUS_CREDIT[assessment.status], 0);
  const controlHealth = reviewed.length === 0 ? 0 : credit / reviewed.length;

  // 2. Evidence coverage — reviewed controls that map to at least one document.
  const withEvidence = reviewed.filter((assessment) => assessment.matchedItems.length > 0).length;
  const evidenceCoverage = reviewed.length === 0 ? 0 : withEvidence / reviewed.length;

  // 3. Evidence depth — required items satisfied per evidenced control.
  const evidenced = reviewed.filter((assessment) => assessment.matchedItems.length > 0);
  const requiredTotal = evidenced.reduce((sum, a) => sum + a.requiredItems.length, 0);
  const matchedTotal = evidenced.reduce((sum, a) => sum + a.matchedItems.length, 0);
  const evidenceDepth = requiredTotal === 0 ? 0 : matchedTotal / requiredTotal;

  // 4. Remediation planning — findings that carry an owner and a timeline.
  const plannerReady = findings.filter(
    (finding) => finding.recommendation.fix && finding.recommendation.owner && finding.recommendation.timelineDays > 0,
  ).length;
  const remediationCoverage = findings.length === 0 ? 1 : plannerReady / findings.length;

  const components: ReadinessComponent[] = [
    {
      key: 'controlHealth',
      label: 'Control health',
      weight: SCORE_WEIGHTS.controlHealth,
      value: round(controlHealth),
      weighted: round(controlHealth * SCORE_WEIGHTS.controlHealth),
      description: 'Status-weighted credit across reviewed controls (partial controls earn 70% credit).',
    },
    {
      key: 'evidenceCoverage',
      label: 'Evidence coverage',
      weight: SCORE_WEIGHTS.evidenceCoverage,
      value: round(evidenceCoverage),
      weighted: round(evidenceCoverage * SCORE_WEIGHTS.evidenceCoverage),
      description: 'Share of reviewed controls that map to at least one piece of evidence.',
    },
    {
      key: 'evidenceDepth',
      label: 'Evidence depth',
      weight: SCORE_WEIGHTS.evidenceDepth,
      value: round(evidenceDepth),
      weighted: round(evidenceDepth * SCORE_WEIGHTS.evidenceDepth),
      description: 'Required evidence items satisfied for controls that already have some evidence.',
    },
    {
      key: 'remediationCoverage',
      label: 'Remediation planning',
      weight: SCORE_WEIGHTS.remediationCoverage,
      value: round(remediationCoverage),
      weighted: round(remediationCoverage * SCORE_WEIGHTS.remediationCoverage),
      description: 'Open findings that have a recommended fix, an owner and a timeline.',
    },
  ];

  const index = Math.round(
    components.reduce((sum, component) => sum + component.value * component.weight, 0) * 100,
  );
  const { band, label } = scoreBand(index);

  return {
    index,
    band,
    // An index of 0 simply means nothing has been reviewed yet.
    bandLabel: reviewed.length === 0 ? 'Not started' : label,
    components,
    counts,
    openFindings: findings.length,
    methodology: SCORE_METHODOLOGY,
  };
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

export function emptyReadiness(frameworkKey: FrameworkKey): ReadinessScore {
  return {
    index: 0,
    band: 'critical',
    bandLabel: 'Not started',
    components: [
      {
        key: 'controlHealth',
        label: 'Control health',
        weight: SCORE_WEIGHTS.controlHealth,
        value: 0,
        weighted: 0,
        description: `No controls have been reviewed for ${frameworkKey === 'soc2' ? 'SOC 2' : 'ISO 27001'} yet.`,
      },
    ],
    counts: { total: 0, reviewed: 0, passed: 0, needsAttention: 0, missing: 0, needsReview: 0 },
    openFindings: 0,
    methodology: SCORE_METHODOLOGY,
  };
}
