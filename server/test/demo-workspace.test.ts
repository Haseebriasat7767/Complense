/**
 * Deterministic engine tests.
 *
 * The core product promise is that the same demo workspace always produces the
 * same analysis: access-control evidence lands on the access-control controls,
 * incident-response evidence lands on the incident-response controls, and
 * controls with no evidence at all are reported as missing.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDemoEvidence } from '../src/domain/evidence-seed.js';
import { evidenceCoverageSummary, snapshotForFramework, type FrameworkSnapshot } from '../src/services/readiness.js';
import type { EvidenceRecord } from '../src/domain/types.js';

let evidence: EvidenceRecord[];
let soc2: FrameworkSnapshot;
let iso: FrameworkSnapshot;

beforeAll(() => {
  evidence = buildDemoEvidence('org_test', 'ws_test', 'tester@complylens.ai').map((document, index) => ({
    ...document,
    id: document.id ?? `ev-test-${index}`,
  }));
  soc2 = snapshotForFramework('soc2', evidence);
  iso = snapshotForFramework('iso27001', evidence);
});

describe('seeded demo workspace', () => {
  it('ships ten demo documents including the eight named samples', () => {
    const names = evidence.map((document) => document.fileName);
    expect(evidence.length).toBe(10);
    for (const expected of [
      'Access_Control_Policy.pdf',
      'Employee_Security_Training.pdf',
      'Incident_Response_Plan.pdf',
      'Backup_and_Recovery_Policy.pdf',
      'Vendor_Risk_Assessment.pdf',
      'Security_Awareness_Policy.pdf',
      'Data_Protection_Policy.pdf',
      'Business_Continuity_Plan.pdf',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('produces the documented readiness scores', () => {
    expect(soc2.readiness.index).toBe(92);
    expect(soc2.readiness.bandLabel).toBe('Strong readiness');
    expect(iso.readiness.index).toBe(78);
    expect(iso.readiness.bandLabel).toBe('Moderate readiness');
  });

  it('reports the documented SOC 2 control counts', () => {
    expect(soc2.readiness.counts).toEqual({
      total: 28,
      reviewed: 24,
      passed: 18,
      needsAttention: 4,
      missing: 2,
      needsReview: 4,
    });
  });

  it('is deterministic — repeated analysis returns identical results', () => {
    const again = snapshotForFramework('soc2', evidence);
    expect(JSON.stringify(again.readiness)).toBe(JSON.stringify(soc2.readiness));
    expect(again.findings.map((finding) => finding.id)).toEqual(soc2.findings.map((finding) => finding.id));
  });

  it('maps access-control evidence to SOC 2 CC6.1 as partially covered, not passed', () => {
    const control = soc2.assessments.find((assessment) => assessment.controlCode === 'SOC2-CC6.1');
    expect(control).toBeDefined();
    // The access-control policy exists, but no quarterly access-review evidence does.
    expect(control?.status).toBe('needs_attention');
    expect(control?.riskLevel).toBe('high');
    expect(control?.missingItems.length ?? 0).toBeGreaterThan(0);
    expect(control?.evidenceIds.length ?? 0).toBeGreaterThan(0);
  });

  it('maps incident-response evidence to the incident-response controls', () => {
    const incidentControls = soc2.assessments.filter((assessment) => assessment.category === 'Incident Response');
    expect(incidentControls.length).toBeGreaterThan(0);
    expect(incidentControls.every((assessment) => assessment.evidenceIds.length > 0)).toBe(true);
  });

  it('flags the controls with no supporting evidence as missing', () => {
    const missing = soc2.assessments.filter((assessment) => assessment.status === 'missing');
    expect(missing.map((assessment) => assessment.controlCode).sort()).toEqual(['SOC2-CC7.2', 'SOC2-CC8.1']);
  });

  it('produces a remediation recommendation for every finding', () => {
    for (const snapshot of [soc2, iso]) {
      expect(snapshot.findings.length).toBeGreaterThan(0);
      for (const finding of snapshot.findings) {
        expect(finding.recommendation.fix.length).toBeGreaterThan(10);
        expect(finding.recommendation.owner.length).toBeGreaterThan(0);
        expect(finding.recommendation.timelineDays).toBeGreaterThan(0);
        expect(finding.aiGenerated).toBe(true);
      }
    }
  });

  it('stores a confidence score for every evidence-to-control link', () => {
    const covered = [...soc2.mappings.values()].flat();
    expect(covered.length).toBeGreaterThan(0);
    for (const entry of covered) {
      expect(entry.confidence).toBeGreaterThan(0);
      expect(entry.confidence).toBeLessThanOrEqual(1);
      expect(soc2.assessments.map((assessment) => assessment.controlId)).toContain(entry.controlId);
    }
  });

  it('leaves one document unmapped so the coverage view has a real warning', () => {
    const coverage = evidenceCoverageSummary(evidence, soc2.mappings);
    expect(coverage.unmappedDocuments).toContain('Legacy_Data_Flow_Diagram.pdf');
  });
});
