/**
 * Evidence category inference shared by uploads and report inventories.
 * Filename matches are intentionally stronger than broad body-text mentions;
 * generic words such as "incident", "complaint" or "investigation" must not
 * override a clearly named security policy, vendor review or access policy.
 */
import { CONTROL_LIBRARY } from './controls.js';

const VALID_CATEGORIES = new Set(CONTROL_LIBRARY.map((control) => control.category));

const RULES: Array<{ category: string; fileName: RegExp[]; content: RegExp[] }> = [
  { category: 'Security Policies', fileName: [/security[_ -]?policy|information[_ -]?security[_ -]?policy|acceptable[_ -]?use/i], content: [/information security policy/, /security policy/, /acceptable use policy/] },
  { category: 'Access Control', fileName: [/access[_ -]?control|privileged[_ -]?access|permission[_ -]?matrix/i], content: [/access control policy/, /least privilege/, /role-based access/, /access provisioning/] },
  { category: 'Identity', fileName: [/identity|mfa|authentication|password[_ -]?policy/i], content: [/multi.factor authentication/, /two.factor authentication/, /identity and access management/] },
  { category: 'Vendor Management', fileName: [/vendor|supplier|third[_ -]?party/i], content: [/vendor risk assessment/, /supplier assessment/, /third.party risk/, /vendor review/] },
  { category: 'Risk Management', fileName: [/risk[_ -]?(assessment|register|management)/i], content: [/risk assessment methodology/, /risk register/, /risk treatment plan/] },
  { category: 'Change Management', fileName: [/change[_ -]?management|change[_ -]?request|release[_ -]?management/i], content: [/change management procedure/, /change approval/, /release management/] },
  { category: 'Business Continuity', fileName: [/business[_ -]?continuity|disaster[_ -]?recovery/i], content: [/business continuity plan/, /disaster recovery plan/, /recovery time objective/] },
  { category: 'Backup', fileName: [/backup|restore[_ -]?test/i], content: [/backup policy/, /backup and recovery/, /restore test/] },
  { category: 'Monitoring', fileName: [/monitoring|vulnerability|security[_ -]?operations/i], content: [/continuous monitoring/, /vulnerability management/, /security monitoring/] },
  { category: 'Logging', fileName: [/logging|audit[_ -]?log|event[_ -]?log/i], content: [/centralized logging/, /audit log review/, /event logging/] },
  { category: 'Incident Response', fileName: [/incident[_ -]?response|breach[_ -]?response|security[_ -]?incident/i], content: [/incident response plan/, /incident response procedure/, /security incident handling/, /breach response procedure/, /ransomware response/] },
  { category: 'Employee Security', fileName: [/employee[_ -]?(security|training)|security[_ -]?awareness|onboarding/i], content: [/security awareness training/, /employee security training/, /background check/] },
  { category: 'Data Protection', fileName: [/data[_ -]?protection|privacy|encryption|data[_ -]?retention/i], content: [/data protection policy/, /personal data/, /data minimization/, /data retention/] },
];

export function inferEvidenceCategory(fileName: string, content: string, fallback?: string): string {
  const name = fileName.toLowerCase();
  const text = content.toLowerCase();
  let bestCategory = '';
  let bestScore = 0;
  for (const rule of RULES) {
    if (!VALID_CATEGORIES.has(rule.category)) continue;
    const fileScore = rule.fileName.reduce((score, pattern) => score + (pattern.test(name) ? 5 : 0), 0);
    const textScore = rule.content.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0);
    const score = fileScore + textScore;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
    }
  }
  if (bestCategory) return bestCategory;
  if (fallback && VALID_CATEGORIES.has(fallback)) return fallback;
  return VALID_CATEGORIES.has('Security Policies') ? 'Security Policies' : [...VALID_CATEGORIES][0] ?? 'Security Policies';
}
