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
    expect(soc2.readiness.index).toBe(94);
    expect(soc2.readiness.bandLabel).toBe('Strong readiness');
    expect(iso.readiness.index).toBe...[truncated]