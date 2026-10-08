/**
 * DEMO DATA — sample workspace evidence for the fictional company "AcmeCloud".
 *
 * These documents do not belong to any real organisation. Their contents are
 * short synthetic summaries used by the deterministic analysis engine to
 * demonstrate evidence-to-control mapping. No file is written to disk and no
 * real customer data is involved.
 */
import type { EvidenceInput } from './types.js';

export type DemoDocument = {
  key: string;
  fileName: string;
  category: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  status: EvidenceInput['status'];
  summary: string;
  content: string;
};

export const DEMO_WORKSPACE_LABEL = 'Demo Workspace';
export const DEMO_COMPANY_LABEL = 'AcmeCloud (Demo Data)';

export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    key: 'access-control-policy',
    fileName: 'Access_Control_Policy.pdf',
    category: 'Access Control',
    mimeType: 'application/pdf',
    sizeBytes: 284_512,
    uploadedAt: '2026-09-12T09:24:00.000Z',
    status: 'analyzed',
    summary:
      'Logical access requirements, provisioning workflow, authentication standards and boundary protection for production systems.',
    content: [
      'DEMO DATA — fictional sample document for the AcmeCloud demo workspace.',
      'Title: Access Control Policy. Owner: Security Team. Version 4.1. Last reviewed: 2026-08-01.',
      'This Access Control Policy defines the requirements for logical access to production systems and customer data.',
      'Access rights are granted on a least privilege basis and reviewed against job responsibilities.',
      'A role-based access control (RBAC) model is maintained with approved role definitions and an approval matrix owned by the security team.',
      'New accounts follow a documented user provisioning workflow. Every provisioning request requires manager approval before credentials are issued.',
      'Multi-factor authentication is required for administrative and remote access. The password complexity standard requires 14 characters or more.',
      'Sessions automatically terminate after 30 minutes of inactivity (session timeout) and accounts lock after five failed attempts (account lockout).',
      'Identity lifecycle management: each person receives unique user identifiers and no shared accounts are permitted for production systems.',
      'The infrastructure team maintains network boundary protection using firewalls, security groups and network segmentation between environments.',
      'Administrative accounts are limited to named engineers. Segregation of duties is applied between deployment and approval responsibilities.',
      'Access removal follows the termination checklist and is completed within 24 hours of the last working day.',
    ].join('\n'),
  },
  {
    key: 'security-awareness-policy',
    fileName: 'Security_Awareness_Policy.pdf',
    category: 'Security Policies',
    mimeType: 'application/pdf',
    sizeBytes: 198_240,
    uploadedAt: '2026-09-12T09:31:00.000Z',
    status: 'analyzed',
    summary:
      'Information security policy covering governance, management oversight, acceptable use and policy review cadence.',
    content: [
      'DEMO DATA — fictional sample document for the AcmeCloud demo workspace.',
      'Title: Information Security Policy. Owner: Compliance Lead. Version 7.0. Approved by the leadership team.',
      'This Information Security Policy is approved and reviewed annually by management (annual policy review).',
      'Governance structure: a security steering committee meets quarterly and reports to the leadership team. The committee charter assigns control ownership across engineering, IT and people operations.',
      'Management oversight of the information security programme includes a quarterly management review of risks, incidents and open exceptions.',
      'Security roles and responsibilities are described in the security handbook issued to every team member.',
      'Acceptable use policy: personnel must not store customer data on personal devices or unmanaged storage.',
      'All personnel acknowledge the code of conduct annually. The whistleblower channel is available for reporting concerns anonymously.',
      'Compliance with policies and regulatory requirements is reviewed by the compliance lead each year, covering the control framework and open exceptions.',
      'Policy exception process: exceptions require a documented business justification, an owner and an expiry date.',
    ].join('\n'),
  },
  {
    key: 'employee-security-training',
    fileName: 'Employee_Security_Training.pdf',
    category: 'Employee Security',
    mimeType: 'application/pdf',
    sizeBytes: 412_984,
    uploadedAt: '2026-09-15T14:02:00.000Z',
    status: 'analyzed',
    summary:
      'Training programme outline, acknowledgement process and confidentiality obligations for employees and contractors.',
    content: [
      'DEMO DATA — fictional sample document for the AcmeCloud demo workspace.',
      'Title: Employee Security Training Programme. Owner: People Operations. Version 3.2.',
      'Security awareness training is assigned to every employee and contractor at onboarding security training and repeated annually (security awareness training).',
      'Completion is tracked in the learning platform. Training completion records and the training completion rate are reported to management every quarter.',
      'All personnel acknowledge the code of conduct and the acceptable use policy as part of the programme.',
      'Policy acknowledgement is recorded per person with a timestamp in the HR system.',
      'Every team member signs a confidentiality agreement (non-disclosure agreement) containing confidentiality obligations that outlive employment.',
      'Phishing awareness exercises are run twice a year and results are shared with the security steering committee.',
      'Security responsibilities for managers include approving access requests and confirming that leavers complete offboarding.',
      'Contractor agreements include the same confidentiality requirements and training obligations as employee agreements.',
    ].join('\n'),
  },
  {
    key: 'incident-response-plan',
    fileName: 'Incident_Response_Plan.pdf',
    category: 'Incident Response',
    mimeType: 'application/pdf',
    sizeBytes: 356_720,
    uploadedAt: '2026-09-18T10:15:00.000Z',
    status: 'analyzed',
    summary:
      'Incident classification, response phases, escalation path and corrective-action tracking.',
    content: [
      'DEMO DATA — fictional sample document for the AcmeCloud demo workspace.',
      'Title: Incident Response Plan. Owner: Security Operations. Version 5.0.',
      'This Incident Response Plan defines how the company detects, classifies, responds to and learns from security incidents.',
      'Incident classification uses four severity levels with a severity matrix and defined handling windows per level.',
      'Response follows defined phases: detection, analysis, containment, eradication and recovery, followed by a post-incident review.',
      'The incident response team consists of the security lead, the on-call engineer and the communications owner. The escalation path is published in the on-call rotation.',
      'Incident communication and customer notification are coordinated with legal and account owners.',
      'Lessons learned are recorded after every high severity incident and tracked as corrective action items with owners and due dates.',
      'Tabletop exercises are scheduled annually for the response team and facilitated by the security lead.',
      'Vulnerability scanning is performed monthly by the operations team as an input to incident detection.',
    ].join('\n'),
  },
  {
    key: 'backup-recovery',
    fileName: 'Backup_and_Recovery_Policy.pdf',
    category: 'Backup',
    mimeType: 'application/pdf',
    sizeBytes: 231_488,
    uploadedAt: '2026-09-22T08:47:00.000Z',
    status: 'analyzed',
    summary:
      'Backup policy, schedule, retention, recovery objectives and restore testing arrangements.',
    content: [
      'DEMO DATA — fictional sample document for the AcmeCloud demo workspace.',
      'Title: Backup and Recovery Policy. Owner: Infrastructure. Version 2.6.',
      'This Backup and Recovery Policy defines the backup policy for all production data stores and configuration repositories.',
      'Backups run daily according to the backup schedule, with encrypted backups stored in a separate region.',
      'Backup retention is 35 days for operational data and 12 months for the annual archive set.',
      'Recovery objectives: recovery time objective (RTO) of four hours and recovery point objective (RPO) of one hour for tier-1 services.',
      'Restore testing is scheduled quarterly. Restore tests are performed by the platform team on a copy of production data.',
      'Offsite replication keeps encrypted copies in a second region with independent access controls.',
      'Backup job success is reviewed daily by the operations team, and failures are escalated to the infrastructure lead.',
    ].join('\n'),
  },
  {
    key: 'vendor-risk-assessment',
    fileName: 'Vendor_Risk_Assessment.pdf',
    category: 'Vendor Management',
    mimeType: 'application/pdf',
    sizeBytes: 302_080,
    uploadedAt: '2026-09-26T11:38:00.000Z',
    status: 'analyzed',
    summary:
      'Third-party risk process, due diligence workflow, questionnaire standard and re-assessment triggers.',
    content: [
      'DEMO DATA — fictional sample document for the AcmeCloud demo workspace.',
      'Title: Vendor Risk Assessment. Owner: Procurement and Security. Version 3.4.',
      'This Vendor Risk Assessment process covers third-party risk for vendors with access to customer data or production systems.',
      'New vendors complete due diligence using the vendor security questionnaire and are recorded in the vendor inventory with a risk tier.',
      'Supplier security requirements follow the security baseline; fraud risk is considered during vendor selection and contract review.',
      'Contractual security requirements are negotiated with each vendor before onboarding and reviewed by legal.',
      'Vendor risk re-assessment triggers include a change of subprocessors, a material security incident, or the introduction of a new data category.',
      'Higher tier vendors are reviewed more frequently, and results are recorded in the vendor inventory record.',
    ].join('\n'),
  },
  {
    key: 'data-protection-policy',
    fileName: 'Data_Protection_Policy.pdf',
    category: 'Data Protection',
    mimeType: 'application/pdf',
    sizeBytes: 468_992,
    uploadedAt: '2026-09-29T15:12:00.000Z',
    status: 'analyzed',
    summary:
      'Data classification, handling requirements, encryption standards, retention and privacy commitments for customer and personal data.',
    content: [
      'DEMO DATA — fictional sample document for the AcmeCloud demo workspace.',
      'Title: Data Protection Policy. Owner: Data Protection Lead. Version 6.1.',
      'This Data Protection Policy governs the handling of customer data and personal data across the service.',
      'Data classification: four levels (public, internal, confidential, restricted) are defined in the classification standard.',
      'Information handling requirements are specified per classification level, including storage, sharing and labelling expectations.',
      'Encryption in transit uses TLS 1.2 or higher for all external interfaces. Encryption at rest uses AES-256.',
      'Encryption key rotation occurs annually under the key management process.',
      'Endpoint protection (EDR) is deployed across the fleet and malware alerting is routed to the security channel.',
      'Data retention periods are defined per information class. Secure deletion is performed on schedule and data disposal certificates are retained when media is retired.',
      'Access to personal data is restricted on a need-to-know basis and reviewed with the data protection lead.',
      'A privacy notice is published for customers. Customer notification and breach notification timelines are aligned with the incident response plan.',
      'A PII inventory and records of processing are maintained by the data protection lead.',
      'An inventory of information assets is maintained by the data protection lead; asset owners are recorded for every system and service.',
      'The security control set is aligned to the ISO 27001 control framework. Risk-based control selection ensures controls mapped to risks are implemented and tested.',
    ].join('\n'),
  },
  {
    key: 'business-continuity-plan',
    fileName: 'Business_Continuity_Plan.pdf',
    category: 'Business Continuity',
    mimeType: 'application/pdf',
    sizeBytes: 275_456,
    uploadedAt: '2026-10-02T09:05:00.000Z',
    status: 'analyzed',
    summary:
      'Continuity scope, business impact analysis, risk appetite, recovery strategies and control review calendar.',
    content: [
      'DEMO DATA — fictional sample document for the AcmeCloud demo workspace.',
      'Title: Business Continuity Plan. Owner: Operations. Version 4.0.',
      'The Business Continuity Plan covers the critical business processes identified in the business impact analysis.',
      'Risk appetite and risk tolerance are defined by the leadership team as part of the annual risk assessment.',
      'Recovery strategies describe how services resume. Tier-1 services target an RTO of four hours and an RPO of one hour.',
      'The crisis management team coordinates internal and external communications during a disruption.',
      'Control testing schedule: a control review calendar lists each control owner, the test to be performed and the due date.',
      'Annual control review results are reported to the security steering committee together with any open exceptions.',
      'Key services run on high availability infrastructure spread across two regions with automated health checks.',
      'The plan is exercised by tabletop discussion with process owners and reviewed annually by operations leadership.',
    ].join('\n'),
  },
  {
    key: 'vendor-questionnaire-q3',
    fileName: 'Vendor_Security_Questionnaire_Q3.pdf',
    category: 'Vendor Management',
    mimeType: 'application/pdf',
    sizeBytes: 148_480,
    uploadedAt: '2026-10-05T13:44:00.000Z',
    status: 'needs_review',
    summary:
      'Vendor questionnaire responses submitted as a scanned form. Extraction quality is low and the document needs manual review.',
    content: [
      'DEMO DATA — fictional sample document for the AcmeCloud demo workspace.',
      'Title: Vendor Security Questionnaire — Q3 responses. Submitted as a scan; extraction quality 58 percent.',
      'Responses were collected from a subprocessor and reference the annual vendor review cycle and the vendor inventory record.',
      'Several answers were handwritten and could not be read reliably. Document flagged for manual review before it is used as evidence.',
    ].join('\n'),
  },
  {
    key: 'legacy-data-flow-diagram',
    fileName: 'Legacy_Data_Flow_Diagram.pdf',
    category: 'Data Protection',
    mimeType: 'application/pdf',
    sizeBytes: 3_182_592,
    uploadedAt: '2026-10-06T16:20:00.000Z',
    status: 'failed',
    summary:
      'Scanned diagram with no extractable text. Analysis failed — re-upload a text-based export or an OCR-processed copy.',
    content: [
      '[No extractable text: this demo file is a scanned image without an OCR layer.]',
      'ComplyLens cannot map evidence it cannot read. Re-upload a text-based PDF, DOCX, TXT or CSV export.',
    ].join('\n'),
  },
];

export const DEMO_EVIDENCE_IDS: Record<string, string> = Object.fromEntries(
  DEMO_DOCUMENTS.map((doc) => [doc.key, `ev-demo-${doc.key}`]),
);

/** Deterministic demo evidence records for a given workspace. */
export function buildDemoEvidence(
  organizationId: string,
  workspaceId: string,
  uploadedBy: string,
): EvidenceInput[] {
  return DEMO_DOCUMENTS.map((doc) => ({
    id: DEMO_EVIDENCE_IDS[doc.key] as string,
    organizationId,
    workspaceId,
    fileName: doc.fileName,
    fileExtension: doc.fileName.split('.').pop()?.toLowerCase() ?? 'pdf',
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    category: doc.category,
    source: 'demo' as const,
    sourceRef: doc.key,
    uploadedAt: doc.uploadedAt,
    uploadedBy,
    status: doc.status,
    frameworkKeys: ['soc2', 'iso27001'],
    content: doc.content,
    summary: doc.summary,
  }));
}

/** Sample text used when a demo upload must be simulated (no file on disk). */
export function demoUploadSampleText(fileName: string): string {
  return [
    `DEMO DATA — uploaded to the demo workspace as ${fileName}.`,
    'The analysis engine maps this text against control requirements. In a connected deployment the extracted text comes from the uploaded file.',
  ].join('\n');
}
