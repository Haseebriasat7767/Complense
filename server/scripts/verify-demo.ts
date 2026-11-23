/**
 * Demo integrity check.
 *
 * Recomputes the seeded demo workspace through the real analysis engine and
 * asserts the published demo figures. Run with:
 *
 *   npm run verify:demo
 *
 * This is the guard rail that keeps the marketing screenshots, the dashboard
 * tiles and the generated report consistent with the engine.
 */
import { assessFramework, mapEvidenceToControls } from '../src/domain/analysis.js';
import { controlsForFramework } from '../src/domain/controls.js';
import { buildDemoEvidence } from '../src/domain/evidence-seed.js';
import { buildFindings } from '../src/domain/findings.js';
import { computeReadiness } from '../src/domain/scoring.js';
import type { EvidenceRecord, FrameworkKey } from '../src/domain/types.js';

const EXPECTED: Record<FrameworkKey, {
  index: number;
  reviewed: number;
  passed: number;
  needsAttention: number;
  missing: number;
  needsReview: number;
}> = {
  soc2: { index: 77, reviewed: 23, passed: 18, needsAttention: 4, missing: 1, needsReview: 5 },
  iso27001: { index: 61, reviewed: 16, passed: 7, needsAttention: 7, missing: 2, needsReview: 6 },
};

function buildEvidence(): EvidenceRecord[] {
  return buildDemoEvidence('org_acmecloud', 'ws_acmecloud_demo', 'Dana Whitfield').map((input) => ({
    ...input,
    id: input.id as string,
  }));
}

const evidence = buildEvidence();
let failures = 0;

for (const key of ['soc2', 'iso27001'] as FrameworkKey[]) {
  const controls = controlsForFramework(key);
  const assessments = assessFramework(controls, evidence, key);
  const mappings = mapEvidenceToControls(controls, evidence, key);
  const findings = buildFindings(assessments, evidence);
  const readiness = computeReadiness({ assessments, controls, findings });
  const expected = EXPECTED[key];

  console.log(`\n=== ${key.toUpperCase()} ===`);
  console.log(
    `  index ${readiness.index}% · reviewed ${readiness.counts.reviewed}/${readiness.counts.total} · passed ${readiness.counts.passed} · needs attention ${readiness.counts.needsAttention} · missing ${readiness.counts.missing} · needs review ${readiness.counts.needsReview} · findings ${findings.length} · mapped documents ${mappings.size}`,
  );

  const checks = [
    ['index', readiness.index, expected.index],
    ['reviewed', readiness.counts.reviewed, expected.reviewed],
    ['passed', readiness.counts.passed, expected.passed],
    ['needsAttention', readiness.counts.needsAttention, expected.needsAttention],
    ['missing', readiness.counts.missing, expected.missing],
    ['needsReview', readiness.counts.needsReview, expected.needsReview],
  ];

  for (const [name, actual, wanted] of checks) {
    if (actual !== wanted) {
      failures += 1;
      console.error('  MISMATCH ' + key + ' ' + name + ': expected ' + wanted + ', got ' + actual);
    }
  }
}

if (failures > 0) {
  console.error('Demo verification failed: ' + failures + ' mismatch(es).');
  process.exit(1);
}

console.log('Demo verification passed.');
