/**
 * Framework definitions.
 *
 * ComplyLens performs *readiness assessment* only. Nothing in this product
 * certifies a company or replaces an auditor — see the disclaimer in
 * `src/domain/disclaimer.ts` and in every generated report.
 */
import type { FrameworkDefinition, FrameworkKey } from './types.js';

export const FRAMEWORK_DISCLAIMER =
  'ComplyLens AI provides preliminary compliance readiness analysis and does not provide certification, audit opinions, or legal advice.';

export const FRAMEWORKS: Record<FrameworkKey, FrameworkDefinition> = {
  soc2: {
    key: 'soc2',
    name: 'SOC 2 Trust Services Criteria',
    shortName: 'SOC 2',
    version: 'AICPA TSC 2017 (2022 revision)',
    description:
      'Security, availability and confidentiality criteria commonly requested by B2B customers during vendor due diligence.',
    intent:
      'Preparedness review of the trust services criteria mapped to the evidence your team already maintains.',
    readinessLabel: 'Readiness assessment',
    controlCount: 28,
  },
  iso27001: {
    key: 'iso27001',
    name: 'ISO/IEC 27001:2022',
    shortName: 'ISO 27001',
    version: 'ISO/IEC 27001:2022 Annex A',
    description:
      'International information security management standard covering organisational, people, physical and technological controls.',
    intent:
      'Preparedness review of Annex A controls against policies, procedures and operational records.',
    readinessLabel: 'Readiness assessment',
    controlCount: 22,
  },
};

export const FRAMEWORK_KEYS: FrameworkKey[] = ['soc2', 'iso27001'];

export function isFrameworkKey(value: string): value is FrameworkKey {
  return (FRAMEWORK_KEYS as string[]).includes(value);
}

export function frameworkLabel(key: FrameworkKey): string {
  return FRAMEWORKS[key].shortName;
}

/** Categories used across the control library, in display order. */
export const CONTROL_CATEGORIES = [
  'Access Control',
  'Identity',
  'Security Policies',
  'Risk Management',
  'Incident Response',
  'Change Management',
  'Vendor Management',
  'Data Protection',
  'Business Continuity',
  'Monitoring',
  'Logging',
  'Employee Security',
  'Backup',
  'Asset Management',
] as const;

export type ControlCategory = (typeof CONTROL_CATEGORIES)[number];

/** Categories where a maintained policy or procedure is legitimate evidence. */
export const POLICY_DOMAINS: string[] = [
  'Security Policies',
  'Employee Security',
  'Data Protection',
  'Risk Management',
  'Vendor Management',
  'Incident Response',
  'Business Continuity',
];
