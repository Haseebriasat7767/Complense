/**
 * Deterministic local "provider".
 *
 * This is not a language model — it is a rule-based summariser that produces
 * stable, readable output from the evidence text and readiness data. It is the
 * default in demo mode so the product works with zero configuration.
 */
import type { Finding, ReadinessScore } from '../../domain/types.js';

const KEYWORD_RULES: Array<{ keyword: string; patterns: string[] }> = [
  { keyword: 'access control', patterns: ['access control policy', 'least privilege', 'role-based access control'] },
  { keyword: 'identity lifecycle', patterns: ['identity lifecycle', 'unique user identifiers', 'provisioning'] },
  { keyword: 'authentication', patterns: ['multi-factor authentication', 'password complexity', 'session timeout'] },
  { keyword: 'network boundary', patterns: ['firewall', 'network boundary protection', 'network segmentation'] },
  { keyword: 'training & awareness', patterns: ['security awareness training', 'training completion', 'policy acknowledgement'] },
  { keyword: 'incident response', patterns: ['incident response plan', 'incident classification', 'post-incident review'] },
  { keyword: 'vulnerability management', patterns: ['vulnerability scanning', 'vulnerability scan', 'patch management'] },
  { keyword: 'backup & recovery', patterns: ['backup policy', 'backup schedule', 'restore testing', 'recovery time objective'] },
  { keyword: 'vendor risk', patterns: ['vendor risk assessment', 'third-party risk', 'vendor security questionnaire'] },
  { keyword: 'data protection', patterns: ['data classification', 'encryption in transit', 'data retention', 'secure deletion'] },
  { keyword: 'privacy', patterns: ['privacy notice', 'pii inventory', 'records of processing'] },
  { keyword: 'continuity', patterns: ['business continuity plan', 'business impact analysis', 'crisis management team'] },
  { keyword: 'governance', patterns: ['security steering committee', 'management oversight', 'information security policy'] },
  { keyword: 'monitoring', patterns: ['siem', 'security monitoring platform', 'log aggregation'] },
  { keyword: 'change management', patterns: ['change management procedure', 'change advisory board'] },
];

export function demoSummary(input: { content: string; fileName: string; category: string }): {
  summary: string;
  keywords: string[];
} {
  const text = input.content.toLowerCase();
  const keywords = KEYWORD_RULES.filter((rule) => rule.patterns.some((p) => text.includes(p))).map(
    (rule) => rule.keyword,
  );

  const sentences = input.content
    .split(/\n|(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 40 && !line.toLowerCase().startsWith('demo data'))
    .slice(0, 2);

  const summary = sentences.length
    ? `${input.category} evidence. ${sentences.join(' ')}`.slice(0, 320)
    : `${input.category} evidence submitted for analysis. Text extraction produced limited content, so mapping confidence may be reduced.`;

  return { summary, keywords };
}

export function demoNarrative(input: {
  companyName: string;
  frameworkName: string;
  readiness: ReadinessScore;
  findings: Finding[];
  evidenceCount: number;
}): { executiveSummary: string; themes: string[] } {
  const { companyName, frameworkName, readiness, findings, evidenceCount } = input;
  const { counts, index, bandLabel } = readiness;
  const critical = findings.filter((f) => f.riskLevel === 'critical');
  const high = findings.filter((f) => f.riskLevel === 'high');

  const concentration = topCategories(findings, 3);

  const lines: string[] = [];
  lines.push(
    `${companyName} was assessed against ${frameworkName} using ${evidenceCount} evidence document${evidenceCount === 1 ? '' : 's'} submitted to the workspace. The readiness index is ${index}% (${bandLabel.toLowerCase()}), derived from ${counts.reviewed} reviewed controls: ${counts.passed} passed, ${counts.needsAttention} need attention, ${counts.missing} missing, and ${counts.needsReview} awaiting manual review.`,
  );

  if (critical.length > 0) {
    lines.push(
      `${critical.length} control${critical.length === 1 ? '' : 's'} have no supporting evidence at all (${critical
        .map((f) => f.controlCode)
        .join(', ')}). These represent the largest exposure because an auditor would request evidence immediately and none could be produced.`,
    );
  }

  if (high.length > 0) {
    lines.push(
      `${high.length} finding${high.length === 1 ? '' : 's'} are rated high risk, concentrated in ${concentration}. Closing these first typically lifts the readiness index the most per unit of effort.`,
    );
  }

  lines.push(
    `Evidence depth, not evidence volume, is the main constraint: ${counts.reviewed - counts.passed} reviewed controls are supported only partially or not at all. The remediation plan below sequences the work by risk, with suggested owners and timelines for each finding.`,
  );

  lines.push(
    'This assessment reflects the documents present in the workspace on the assessment date. It is a readiness indicator, not an audit opinion.',
  );

  const themes = [
    `Priority wave 1 — ${critical.length + high.length} critical and high findings`,
    `Evidence depth — ${counts.needsAttention + counts.missing} controls with incomplete or absent support`,
    `Manual review — ${counts.needsReview} controls flagged for human verification`,
  ];

  return { executiveSummary: lines.join(' '), themes };
}

function topCategories(findings: Finding[], limit: number): string {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    if (finding.riskLevel === 'critical' || finding.riskLevel === 'high') {
      counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = sorted.slice(0, limit).map(([category]) => category.toLowerCase());
  if (top.length === 0) return 'lower-risk categories';
  if (top.length === 1) return top[0] as string;
  return `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}`;
}
