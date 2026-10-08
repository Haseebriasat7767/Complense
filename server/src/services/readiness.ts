/**
 * Readiness service — the single place where evidence, controls, mappings,
 * findings and the readiness index are assembled for a workspace.
 *
 * Every route that needs an assessment calls these helpers so the numbers in
 * the dashboard, gap analysis, control pages and reports can never drift apart.
 */
import { assessFramework, mapEvidenceToControls } from '../domain/analysis.js';
import { controlsForFramework } from '../domain/controls.js';
import { buildFindings } from '../domain/findings.js';
import { computeReadiness } from '../domain/scoring.js';
import type {
  ControlAssessment,
  EvidenceRecord,
  Finding,
  FrameworkKey,
  MappingEntry,
  ReadinessScore,
} from '../domain/types.js';

export type FrameworkSnapshot = {
  frameworkKey: FrameworkKey;
  assessments: ControlAssessment[];
  findings: Finding[];
  readiness: ReadinessScore;
  mappings: Map<string, MappingEntry[]>;
};

export function snapshotForFramework(
  frameworkKey: FrameworkKey,
  evidence: EvidenceRecord[],
): FrameworkSnapshot {
  const controls = controlsForFramework(frameworkKey);
  const assessments = assessFramework(controls, evidence, frameworkKey);
  const mappings = mapEvidenceToControls(controls, evidence, frameworkKey);
  const findings = buildFindings(assessments, evidence);
  const readiness = computeReadiness({ assessments, controls, findings });

  return { frameworkKey, assessments, findings, readiness, mappings };
}

export function snapshotForFrameworks(
  frameworkKeys: FrameworkKey[],
  evidence: EvidenceRecord[],
): Map<FrameworkKey, FrameworkSnapshot> {
  const result = new Map<FrameworkKey, FrameworkSnapshot>();
  for (const key of frameworkKeys) result.set(key, snapshotForFramework(key, evidence));
  return result;
}

/** Aggregate evidence coverage used by the dashboard and evidence pages. */
export function evidenceCoverageSummary(
  evidence: EvidenceRecord[],
  mappings: Map<string, MappingEntry[]>,
) {
  const total = evidence.length;
  const analyzed = evidence.filter((doc) => doc.status === 'analyzed').length;
  const needsReview = evidence.filter((doc) => doc.status === 'needs_review').length;
  const failed = evidence.filter((doc) => doc.status === 'failed').length;
  const analyzing = evidence.filter((doc) => doc.status === 'analyzing').length;
  const mappedControls = new Set<string>();
  const unmappedDocuments: string[] = [];

  for (const doc of evidence) {
    const entries = mappings.get(doc.id) ?? [];
    if (entries.length === 0 && doc.status !== 'analyzing') {
      unmappedDocuments.push(doc.fileName);
      continue;
    }
    for (const entry of entries) mappedControls.add(entry.controlId);
  }

  return {
    total,
    analyzed,
    needsReview,
    failed,
    analyzing,
    distinctControlsCovered: mappedControls.size,
    unmappedDocuments,
  };
}
