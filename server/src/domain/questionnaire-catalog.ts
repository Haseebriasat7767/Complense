/**
 * Canonical questionnaire library — the 25 seeded questions every
 * questionnaire starts from.
 *
 * These are the questions buyers ask most often in vendor security reviews
 * (SOC 2, ISO 27001 and generic vendor questionnaires). Each one points at
 * the ComplyLens controls it answers, so a reusable answer can be grounded
 * in the evidence already mapped to those controls.
 *
 * Matching is deliberately strict: reuse is suggested only by canonical
 * slug, never by fuzzy text similarity, and nothing is reused without a
 * human explicitly confirming it.
 */
import type { CanonicalQuestion } from './types.js';

export const CANONICAL_QUESTIONS: CanonicalQuestion[] = [
  // --- SOC 2 (7) -------------------------------------------------------
  {
    slug: 'soc2-mfa-access-control',
    framework: 'soc2',
    category: 'Access Control',
    question: 'Do you enforce multi-factor authentication (MFA) for all user access to production systems and administrative consoles?',
    guidance: 'Name the MFA method, who it applies to, and how exceptions are handled and reviewed.',
    relatedControls: ['SOC2-CC6.1', 'SOC2-CC6.6'],
  },
  {
    slug: 'soc2-change-management',
    framework: 'soc2',
    category: 'Change Management',
    question: 'Describe your change management process for production systems, including approval, testing and rollback.',
    guidance: 'Cover who approves changes, how they are tested before deployment, and how a bad change is rolled back.',
    relatedControls: ['SOC2-CC8.1'],
  },
  {
    slug: 'soc2-incident-response',
    framework: 'soc2',
    category: 'Incident Response',
    question: 'Do you have a documented incident response plan, and how quickly are customers notified of a security incident affecting their data?',
    guidance: 'Give the notification window, the roles involved, and how incidents are reviewed afterwards.',
    relatedControls: ['SOC2-CC7.3', 'SOC2-CC7.4'],
  },
  {
    slug: 'soc2-vendor-management',
    framework: 'soc2',
    category: 'Vendor Management',
    question: 'How do you assess and monitor the security of third-party vendors and subprocessors that handle customer data?',
    guidance: 'Mention reviews, contracts, and how often vendors are re-assessed.',
    relatedControls: ['SOC2-CC9.1', 'SOC2-CC9.2'],
  },
  {
    slug: 'soc2-encryption',
    framework: 'soc2',
    category: 'Data Protection',
    question: 'Is customer data encrypted in transit and at rest, and how are encryption keys managed?',
    guidance: 'State the encryption standards used and who can access keys.',
    relatedControls: ['SOC2-CC6.1', 'SOC2-CC6.7'],
  },
  {
    slug: 'soc2-backups-recovery',
    framework: 'soc2',
    category: 'Business Continuity',
    question: 'How are backups performed and tested, and what are your recovery time and recovery point objectives (RTO/RPO)?',
    guidance: 'Give backup frequency, restore-test frequency, and the RTO/RPO figures.',
    relatedControls: ['SOC2-CC7.2'],
  },
  {
    slug: 'soc2-security-training',
    framework: 'soc2',
    category: 'Employee Security',
    question: 'Do all employees complete security awareness training, and how often is it refreshed?',
    guidance: 'Cover onboarding training, refresh cadence, and how completion is tracked.',
    relatedControls: ['SOC2-CC1.1', 'SOC2-CC2.2'],
  },

  // --- ISO 27001 (7) ---------------------------------------------------
  {
    slug: 'iso-isms-scope',
    framework: 'iso27001',
    category: 'ISMS',
    question: 'What is the scope of your Information Security Management System (ISMS), and is it certified to ISO/IEC 27001?',
    guidance: 'State the scope, certification status and certificate holder, or the target date if certification is in progress.',
    relatedControls: ['ISO-A.5.15', 'ISO-A.5.36'],
  },
  {
    slug: 'iso-risk-assessment',
    framework: 'iso27001',
    category: 'Risk Management',
    question: 'How often do you perform information security risk assessments, and how are risks treated and tracked to closure?',
    guidance: 'Cover assessment cadence, the risk register, and who owns treatment plans.',
    relatedControls: ['ISO-A.5.18', 'ISO-A.5.19'],
  },
  {
    slug: 'iso-asset-inventory',
    framework: 'iso27001',
    category: 'Asset Management',
    question: 'Do you maintain an inventory of information assets, and who is accountable for each asset?',
    guidance: 'Describe what is inventoried and how ownership is assigned.',
    relatedControls: ['ISO-A.5.9'],
  },
  {
    slug: 'iso-access-review',
    framework: 'iso27001',
    category: 'Access Control',
    question: 'How often are user access rights reviewed, and how quickly is access removed when someone leaves?',
    guidance: 'Give the review cadence and the deprovisioning window.',
    relatedControls: ['ISO-A.5.15', 'ISO-A.5.18'],
  },
  {
    slug: 'iso-cryptography-policy',
    framework: 'iso27001',
    category: 'Cryptography',
    question: 'Do you have a cryptography policy covering encryption algorithms, key lengths and key lifecycle management?',
    guidance: 'Name the policy and the standards it follows.',
    relatedControls: ['ISO-A.5.24', 'ISO-A.8.10'],
  },
  {
    slug: 'iso-supplier-security',
    framework: 'iso27001',
    category: 'Supplier Security',
    question: 'How do you manage information security in supplier relationships, including agreements and ongoing monitoring?',
    guidance: 'Cover contractual clauses, security requirements passed to suppliers, and monitoring.',
    relatedControls: ['ISO-A.5.19', 'ISO-A.5.20'],
  },
  {
    slug: 'iso-internal-audit',
    framework: 'iso27001',
    category: 'Audit & Review',
    question: 'Do you perform internal audits of your ISMS, and how are findings tracked and closed?',
    guidance: 'Give audit frequency, who performs them, and how findings are followed up.',
    relatedControls: ['ISO-A.5.36'],
  },

  // --- Generic vendor security (11) ------------------------------------
  {
    slug: 'generic-data-residency',
    framework: 'generic',
    category: 'Data Hosting',
    question: 'Where is customer data hosted and processed, and in which countries or regions does it reside?',
    guidance: 'List cloud providers, regions, and any data-residency options.',
    relatedControls: ['SOC2-CC6.1', 'ISO-A.5.9'],
  },
  {
    slug: 'generic-subprocessors',
    framework: 'generic',
    category: 'Subprocessors',
    question: 'Provide a current list of subprocessors that process customer data, and how you notify customers of changes.',
    guidance: 'Point at the public subprocessor list and the change-notification process.',
    relatedControls: ['SOC2-CC9.2', 'ISO-A.5.19'],
  },
  {
    slug: 'generic-pen-testing',
    framework: 'generic',
    category: 'Testing',
    question: 'How often do you perform penetration testing and vulnerability assessments, and who performs them?',
    guidance: 'Give frequency, tester independence, and how findings are remediated.',
    relatedControls: ['SOC2-CC7.1', 'ISO-A.8.8'],
  },
  {
    slug: 'generic-vulnerability-management',
    framework: 'generic',
    category: 'Vulnerability Management',
    question: 'Describe your vulnerability management process, including patching timelines for critical vulnerabilities.',
    guidance: 'Cover scanning, severity triage, and patch SLAs.',
    relatedControls: ['SOC2-CC7.1', 'ISO-A.8.8'],
  },
  {
    slug: 'generic-dpa-gdpr',
    framework: 'generic',
    category: 'Privacy',
    question: 'Do you offer a Data Processing Agreement (DPA), and how do you comply with GDPR and other privacy regulations?',
    guidance: 'Mention the DPA, data-subject request handling, and the privacy contact.',
    relatedControls: ['SOC2-CC2.2', 'ISO-A.5.34'],
  },
  {
    slug: 'generic-data-retention-deletion',
    framework: 'generic',
    category: 'Data Lifecycle',
    question: 'How long do you retain customer data, and how is it securely deleted at the end of retention or on request?',
    guidance: 'State retention periods, deletion method, and deletion-on-request timing.',
    relatedControls: ['SOC2-CC6.1', 'ISO-A.5.9'],
  },
  {
    slug: 'generic-sso-saml',
    framework: 'generic',
    category: 'Authentication',
    question: 'Do you support single sign-on (SSO/SAML) and SCIM provisioning for enterprise customers?',
    guidance: 'List supported identity providers and provisioning options.',
    relatedControls: ['SOC2-CC6.6', 'ISO-A.5.15'],
  },
  {
    slug: 'generic-audit-logs',
    framework: 'generic',
    category: 'Logging',
    question: 'Do you maintain audit logs of access to customer data, and how long are they retained and protected?',
    guidance: 'Cover what is logged, retention, and who can access logs.',
    relatedControls: ['SOC2-CC7.2', 'ISO-A.8.15'],
  },
  {
    slug: 'generic-uptime-sla',
    framework: 'generic',
    category: 'Availability',
    question: 'What uptime SLA do you offer, and what is your recent availability track record?',
    guidance: 'Give the SLA figure, status-page link, and recent uptime if published.',
    relatedControls: ['SOC2-CC7.2'],
  },
  {
    slug: 'generic-breach-notification',
    framework: 'generic',
    category: 'Incident Response',
    question: 'How and within what timeframe will you notify customers of a data breach affecting their data?',
    guidance: 'State the notification window and the communication channel.',
    relatedControls: ['SOC2-CC7.4', 'ISO-A.5.24'],
  },
  {
    slug: 'generic-certifications-insurance',
    framework: 'generic',
    category: 'Assurance',
    question: 'Which security certifications, attestations or audit reports can you share (SOC 2, ISO 27001, pen test reports)?',
    guidance: 'List what is available under NDA and how a buyer requests it.',
    relatedControls: ['SOC2-CC1.1', 'ISO-A.5.36'],
  },
];

export function findCanonicalQuestion(slug: string): CanonicalQuestion | undefined {
  return CANONICAL_QUESTIONS.find((item) => item.slug === slug);
}

/** Normalised-text fallback for matching a pasted question to the catalog. */
export function normalizeQuestionText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function findCanonicalByText(value: string): CanonicalQuestion | undefined {
  const normalized = normalizeQuestionText(value);
  if (!normalized) return undefined;
  return CANONICAL_QUESTIONS.find((item) => normalizeQuestionText(item.question) === normalized);
}
