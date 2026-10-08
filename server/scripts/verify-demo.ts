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
  soc2: { index: 92, reviewed: 24, passed: 18, needsAttention: 4, missing: 2, needsReview: 4 },
  iso27001: { index: 78, reviewed: 18, passed: 7, needsAttention: 7, missing: 4, needsReview: 4 },
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
    `  index ${readiness.index}% · reviewed ${readiness.counts.reviewed}/${readiness.counts.total} · passed ${readiness.counts.passed} · needs attention ${readiness.counts.needsAttention} · missing ${readiness.counts.missing} · needs review ${readiness.counts.needsReview}`,
  );
  console.log(
    `  components: ${readiness.components.map((c) => `${c.label} ${(c.value * 100).toFixed(1)}%×${c.weight}`).join(' | ')}`,
  );
  console.log(`  findings: ${findings.length} (${['critical', 'high', 'medium', 'low'].map((risk) => `${risk} ${findings.filter((f) => f.riskLevel === risk).length}`).join(', ')})`);

  const checks: Array<[string, number, number]> = [
    ['index', readiness.index, expected.index],
    ['reviewed', readiness.counts.reviewed, expected.reviewed],
    ['passed', readiness.counts.passed, expected.passed],
    ['needsAttention', readiness.counts.needsAttention, expected.needsAttention],
    ['missing', readiness.counts.missing, expected.missing],
    ['needsReview', readiness.counts.needsReview, expected.needsReview],
  ];

  for (const [label, actual, want] of checks) {
    const ok = actual === want;
    if (!ok) failures += 1;
    console.log(`  ${ok ? '✓' : '✗'} ${label}: ${actual}${ok ? '' : ` (expected ${want})`}`);
  }

  const unmapped = evidence.filter((doc) => (mappings.get(doc.id) ?? []).length === 0 && doc.status === 'analyzed');
  if (unmapped.length > 0) {
    console.log(`  note: analysed documents with no mapping → ${unmapped.map((doc) => doc.fileName).join(', ')}`);
  }

  const statuses = assessments.map((a) => `${a.controlCode}=${a.status}`).join(' ');
  if (process.argv.includes('--verbose')) console.log(`  ${statuses}`);
}

console.log(
  failures === 0
    ? '\nAll demo figures match the deterministic analysis engine.\n'
    : `\n${failures} demo figure(s) drifted from the engine output.\n`,
);
process.exit(failures === 0 ? 0 : 1);
