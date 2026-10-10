/**
 * Deterministic evidence analysis engine.
 *
 * The same evidence set always produces the same assessment — there is no
 * randomness and no external service involved. When an AI provider is
 * configured it is used to *narrate* these findings, never to replace them.
 *
 * Matching model
 * --------------
 * 1. Evidence text is normalised (lowercase, whitespace collapsed).
 * 2. A control lists the evidence items it expects, each with literal
 *    "signals" (phrases). A signal present in the text satisfies that item.
 * 3. Documents marked `analyzed` can satisfy items. Documents flagged
 *    `needs_review` only register a weak mention — they never satisfy an item,
 *    because unverified extraction should not close a control.
 * 4. Documents marked `failed` are excluded from matching entirely.
 */
import { getControl, RISK_ORDER } from './controls.js';
import { FRAMEWORK_KEYS } from './frameworks.js';
import type {
  ControlAssessment,
  ControlDefinition,
  EvidenceRecord,
  FrameworkKey,
  MappingEntry,
} from './types.js';

/** Coverage of required items at which a control is considered evidenced. */
export const STATUS_THRESHOLDS = { passed: 0.75, needsAttention: 0.3 } as const;

/** Credit applied to each status when the readiness index is computed. */
export const STATUS_CREDIT: Record<ControlAssessment['status'], number> = {
  passed: 1,
  needs_attention: 0.7,
  missing: 0,
  needs_review: 0,
};

export const STATUS_LABELS: Record<ControlAssessment['status'], string> = {
  passed: 'Passed',
  needs_attention: 'Needs attention',
  missing: 'Missing',
  needs_review: 'Needs review',
};

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remove instructional/template sections before matching controls.
 *
 * Case studies and audit-preparation documents often list evidence an
 * organisation SHOULD provide. Those lists are not proof that the evidence
 * exists. Keep the factual narrative, but exclude sections explicitly framed
 * as evidence requests, suggested mappings, checklists, or source caveats.
 */
export function normalizeEvidenceForMatching(input: string): string {
  const excludedHeadings = [
    /^compliance evidence to request\b/i,
    /^suggested (?:complylens categorisation|framework mapping)\b/i,
    /^test checklist\b/i,
    /^source caveat\b/i,
  ];
  const lines = input.split(/\r?\n/);
  const kept: string[] = [];
  let excludingSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading = /^[A-Z][A-Z0-9 /—–&().:-]{3,}$/.test(trimmed);
    if (excludedHeadings.some((pattern) => pattern.test(trimmed))) {
      excludingSection = true;
      continue;
    }
    // The source documents use blank lines to separate section content.
    // End exclusion at the first paragraph boundary as well as at a heading;
    // otherwise a checklist with sentence-case bullets can hide all later
    // factual incident narrative from the matcher.
    if (excludingSection && (!trimmed || isHeading)) {
      excludingSection = false;
      if (!trimmed) continue;
    }
    if (!excludingSection) kept.push(line);
  }
  return normalizeText(kept.join(' '));
}

export function containsSignal(text: string, signal: string): boolean {
  const needle = normalizeText(signal);
  if (!needle) return false;
  return text.includes(needle);
}

export function countSignalHits(text: string, signals: string[]): number {
  return signals.reduce((hits, signal) => (containsSignal(text, signal) ? hits + 1 : hits), 0);
}

/** Documents that may contribute to matching at all. */
function isAnalyzable(evidence: EvidenceRecord): boolean {
  return evidence.status === 'analyzed' || evidence.status === 'needs_review';
}

type DocSignals = {
  evidence: EvidenceRecord;
  text: string;
  /** needs_review documents can only produce weak mentions. */
  weakOnly: boolean;
};

function prepareDocuments(evidence: EvidenceRecord[], frameworkKey: FrameworkKey): DocSignals[] {
  return evidence
    .filter((doc) => isAnalyzable(doc) && doc.frameworkKeys.includes(frameworkKey))
    .map((doc) => ({
      evidence: doc,
      text: normalizeEvidenceForMatching(doc.content ?? ''),
      weakOnly: doc.status !== 'analyzed',
    }));
}

export type ControlMatch = {
  assessment: ControlAssessment;
  evidenceIds: string[];
};

/** Assess every control of a framework against the workspace evidence. */
export function assessFramework(
  controls: ControlDefinition[],
  evidence: EvidenceRecord[],
  frameworkKey: FrameworkKey,
): ControlAssessment[] {
  const docs = prepareDocuments(evidence, frameworkKey);
  const analysedAt = new Date().toISOString();

  // Nothing uploaded yet: report every control as "not yet assessed" so a new
  // workspace shows honest empty states instead of a wall of red.
  if (docs.length === 0) {
    return controls.map((control) => ({
      controlId: control.id,
      controlCode: control.code,
      frameworkKey: control.frameworkKey,
      category: control.category,
      name: control.name,
      riskLevel: control.riskLevel,
      status: 'needs_review' as const,
      confidence: 0,
      requiredItems: control.requiredEvidence,
      matchedItems: [],
      missingItems: control.requiredEvidence.map((item) => item.label),
      evidenceIds: [],
      analysisNote:
        'No evidence has been submitted for this framework yet. Upload evidence to generate an assessment for this control.',
      updatedAt: analysedAt,
    }));
  }

  return controls.map((control) => {
    const matchedItems: string[] = [];
    const missingItems: string[] = [];
    const evidenceIds = new Set<string>();
    let signalHits = 0;
    let matchedItemCount = 0;
    let weakMention = false;

    for (const item of control.requiredEvidence) {
      let satisfied = false;
      let itemSignalHits = 0;

      for (const doc of docs) {
        const hits = countSignalHits(doc.text, item.signals);
        if (hits === 0) continue;

        if (doc.weakOnly) {
          weakMention = true;
          continue;
        }
        satisfied = true;
        itemSignalHits += hits;
        evidenceIds.add(doc.evidence.id);
      }

      if (satisfied) {
        matchedItems.push(item.label);
        matchedItemCount += 1;
        signalHits += Math.min(2, Math.max(1, itemSignalHits));
      } else {
        missingItems.push(item.label);
      }
    }

    for (const doc of docs) {
      if (countSignalHits(doc.text, control.weakSignals) > 0) weakMention = true;
    }

    const required = control.requiredEvidence.length;
    const coverage = required === 0 ? 0 : matchedItemCount / required;

    let status: ControlAssessment['status'];
    if (required === 0) {
      status = 'needs_review';
    } else if (coverage >= STATUS_THRESHOLDS.passed) {
      status = 'passed';
    } else if (coverage >= STATUS_THRESHOLDS.needsAttention) {
      status = 'needs_attention';
    } else if (weakMention) {
      status = 'needs_review';
    } else {
      status = 'missing';
    }

    const signalStrength = matchedItemCount === 0 ? 0 : signalHits / (matchedItemCount * 2);
    const confidence = Math.min(
      1,
      Math.max(0.05, Number((0.65 * coverage + 0.35 * signalStrength).toFixed(2))),
    );

    const analysisNote = buildAnalysisNote({
      control,
      status,
      matchedItems,
      missingItems,
      documentCount: evidenceIds.size,
    });

    return {
      controlId: control.id,
      controlCode: control.code,
      frameworkKey: control.frameworkKey,
      category: control.category,
      name: control.name,
      riskLevel: control.riskLevel,
      status,
      confidence,
      requiredItems: control.requiredEvidence,
      matchedItems,
      missingItems,
      evidenceIds: [...evidenceIds],
      analysisNote,
      updatedAt: analysedAt,
    } satisfies ControlAssessment;
  });
}

function buildAnalysisNote(input: {
  control: ControlDefinition;
  status: ControlAssessment['status'];
  matchedItems: string[];
  missingItems: string[];
  documentCount: number;
}): string {
  const { control, status, matchedItems, missingItems, documentCount } = input;
  const total = control.requiredEvidence.length;

  if (status === 'passed') {
    return `All ${total} expected evidence item${total === 1 ? '' : 's'} are supported by ${documentCount} document${documentCount === 1 ? '' : 's'}. No action required.`;
  }
  if (status === 'needs_attention') {
    return `Evidence covers ${matchedItems.length} of ${total} expected items. Missing: ${missingItems.join('; ')}.`;
  }
  if (status === 'needs_review') {
    return `The topic is referenced in uploaded evidence but the expected records are not substantiated: ${missingItems.join('; ')}. Manual review required.`;
  }
  return `No supporting evidence was found for ${total} expected item${total === 1 ? '' : 's'}: ${missingItems.join('; ')}.`;
}

/** Evidence → control mapping, computed from the same matching pass. */
export function mapEvidenceToControls(
  controls: ControlDefinition[],
  evidence: EvidenceRecord[],
  frameworkKey: FrameworkKey,
): Map<string, MappingEntry[]> {
  const docs = prepareDocuments(evidence, frameworkKey);
  const result = new Map<string, MappingEntry[]>();
  for (const doc of docs) {
    const entries: MappingEntry[] = [];

    for (const control of controls) {
      if (control.frameworkKey !== frameworkKey) continue;

      const matchedItems: string[] = [];
      const missingItems: string[] = [];
      let signalHits = 0;

      for (const item of control.requiredEvidence) {
        const hits = countSignalHits(doc.text, item.signals);
        if (hits > 0) {
          matchedItems.push(item.label);
          signalHits += Math.min(2, hits);
        } else {
          missingItems.push(item.label);
        }
      }

      if (matchedItems.length === 0) continue;

      const coverage = matchedItems.length / control.requiredEvidence.length;
      const depth = signalHits / (matchedItems.length * 2);
      const base = 0.6 * coverage + 0.4 * depth;
      const confidence = Number(
        Math.min(1, Math.max(0.05, doc.weakOnly ? base * 0.6 : base)).toFixed(2),
      );

      entries.push({
        controlId: control.id,
        controlCode: control.code,
        controlName: control.name,
        frameworkKey: control.frameworkKey,
        category: control.category,
        confidence,
        matchedItems,
        missingItems,
      });
    }

    entries.sort((a, b) => b.confidence - a.confidence || a.controlCode.localeCompare(b.controlCode));
    result.set(doc.evidence.id, entries);
  }
  return result;
}

/** Map each document only to controls in the frameworks selected for it. */
export function mapEvidenceAcrossFrameworks(
  controls: ControlDefinition[],
  evidence: EvidenceRecord[],
): Map<string, MappingEntry[]> {
  const result = new Map<string, MappingEntry[]>();

  for (const frameworkKey of FRAMEWORK_KEYS) {
    const frameworkMappings = mapEvidenceToControls(controls, evidence, frameworkKey);
    for (const [evidenceId, entries] of frameworkMappings) {
      result.set(evidenceId, [...(result.get(evidenceId) ?? []), ...entries]);
    }
  }

  return result;
}

/** Controls sorted for display: worst status first, then highest risk. */
export function sortAssessments(assessments: ControlAssessment[]): ControlAssessment[] {
  const statusOrder: Record<ControlAssessment['status'], number> = {
    missing: 0,
    needs_attention: 1,
    needs_review: 2,
    passed: 3,
  };
  return [...assessments].sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel] ||
      a.controlCode.localeCompare(b.controlCode),
  );
}

/** Resolve a control definition for an assessment (used by findings/reports). */
export function definitionFor(assessment: ControlAssessment): ControlDefinition | undefined {
  return getControl(assessment.controlId);
}
