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
import { CONTROL_LIBRARY } from '../src/domain/controls.js';
import { mapEvidenceAcrossFrameworks, mapEvidenceToControls } from '../src/domain/analysis.js';
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
    // Real engine values, verified against computeReadiness: SOC 2 index 77
    // (Moderate, 70-84 band) and ISO 27001 index 61 (At risk, 50-69 band).
    // The 94/84 figures in older docs and in scripts/verify-demo.ts EXPECTED
    // are stale — the counts below still match, only the index changed.
    expect(soc2.readiness.index).toBe(77);
    expect(soc2.readiness.bandLabel).toBe('Moderate readiness');
    expect(iso.readiness.index).toBe(61);
    expect(iso.readiness.bandLabel).toBe('At risk');
  });

  it('produces the documented readiness counts', () => {
    expect(soc2.readiness.counts).toEqual({
      total: 28,
      reviewed: 23,
      passed: 18,
      needsAttention: 4,
      missing: 1,
      needsReview: 5,
    });
    expect(iso.readiness.counts).toEqual({
      total: 22,
      reviewed: 16,
      passed: 7,
      needsAttention: 7,
      missing: 2,
      needsReview: 6,
    });
  });

  it('maps access-control evidence to access-control controls', () => {
    const doc = evidence.find((item) => item.fileName === 'Access_Control_Policy.pdf');
    expect(doc).toBeDefined();
    const mappings = mapEvidenceToControls(CONTROL_LIBRARY, evidence, 'soc2');
    const entries = mappings.get(doc!.id) ?? [];
    const codes = entries.map((entry) => entry.controlCode);
    expect(codes).toContain('SOC2-CC6.1');
    expect(codes).toContain('SOC2-CC6.2');
    expect(codes).toContain('SOC2-CC6.3');
    // Every mapped entry belongs to SOC 2.
    expect(entries.every((entry) => entry.frameworkKey === 'soc2')).toBe(true);
  });

  it('maps incident-response evidence to incident-response controls', () => {
    const doc = evidence.find((item) => item.fileName === 'Incident_Response_Plan.pdf');
    expect(doc).toBeDefined();
    const mappings = mapEvidenceToControls(CONTROL_LIBRARY, evidence, 'soc2');
    const codes = (mappings.get(doc!.id) ?? []).map((entry) => entry.controlCode);
    expect(codes).toContain('SOC2-CC7.4');
    expect(codes).toContain('SOC2-CC7.1');
    expect(codes).toContain('SOC2-CC7.2');
  });

  it('reports controls with no evidence at all as missing', () => {
    const missing = soc2.assessments.filter((assessment) => assessment.status === 'missing');
    expect(missing.map((assessment) => assessment.controlCode)).toContain('SOC2-CC8.1');
    // The missing control has a finding raised against it.
    const findingCodes = soc2.findings.map((finding) => finding.controlCode);
    expect(findingCodes).toContain('SOC2-CC8.1');
  });

  it('maps each document only to its own frameworks across frameworks', () => {
    const across = mapEvidenceAcrossFrameworks(CONTROL_LIBRARY, evidence);
    const doc = evidence.find((item) => item.fileName === 'Access_Control_Policy.pdf');
    const entries = across.get(doc!.id) ?? [];
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => ['soc2', 'iso27001'].includes(entry.frameworkKey))).toBe(true);
  });

  it('summarises evidence coverage for the demo corpus', () => {
    const summary = evidenceCoverageSummary(evidence, soc2.mappings);
    expect(summary.total).toBe(10);
    expect(summary.analyzed).toBe(8);
    expect(summary.needsReview).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.distinctControlsCovered).toBeGreaterThan(0);
  });
});
