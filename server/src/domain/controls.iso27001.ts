/**
 * ISO/IEC 27001:2022 Annex A — demo control library (22 controls).
 *
 * Readiness assessment only: ComplyLens maps evidence to Annex A controls and
 * highlights gaps. It does not certify or audit an organisation.
 *
 * Demo data — not a licensed reproduction of the ISO standard text.
 */
import type { ControlDefinition } from './types.js';

export const ISO27001_CONTROLS: ControlDefinition[] = [
  {
    id: 'ctl-iso-a5-15',
    code: 'ISO-A.5.15',
    frameworkKey: 'iso27001',
    category: 'Access Control',
    name: 'Access Control',
    description:
      'Rules to control physical and logical access to information and other associated assets are established and implemented.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Access rules must exist as implemented standards and assignments, not only as intent statements.',
    requiredEvidence: [
      {
        label: 'Access control policy',
        signals: ['access control policy', 'logical access'],
      },
      {
        label: 'Access rights allocation standard',
        signals: ['access rights allocation', 'access rights standard'],
      },
      {
        label: 'Segregation of duties matrix',
        signals: ['segregation of duties matrix', 'sod matrix'],
      },
    ],
    weakSignals: ['segregation of duties'],
    remediation: {
      fix: 'Publish the access rights allocation standard with a segregation-of-duties matrix for privileged roles.',
      owner: 'Security / IT',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-iso-a5-16',
    code: 'ISO-A.5.16',
    frameworkKey: 'iso27001',
    category: 'Identity',
    name: 'Identity Management',
    description:
      'The full lifecycle of identities is managed, with unique identifiers and no shared accounts.',
    riskLevel: 'medium',
    isPolicyDomain: false,
    rationale:
      'Unique identities are a prerequisite for attributing activity in any investigation.',
    requiredEvidence: [
      { label: 'Identity lifecycle management', signals: ['identity lifecycle'] },
      {
        label: 'Unique user identifiers and no shared accounts',
        signals: ['unique user identifiers', 'no shared accounts'],
      },
    ],
    weakSignals: ['identity'],
    remediation: {
      fix: 'Document provisioning, transfer and deprovisioning steps and eliminate shared administrative accounts.',
      owner: 'Security / IT',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-iso-a5-18',
    code: 'ISO-A.5.18',
    frameworkKey: 'iso27001',
    category: 'Access Control',
    name: 'Access Rights',
    description:
      'Access rights to information and assets are provisioned, reviewed, modified and removed according to policy.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Review and removal records prove that rights do not accumulate indefinitely over time.',
    requiredEvidence: [
      {
        label: 'Access rights provisioning and removal',
        signals: ['user provisioning workflow', 'access removal', 'termination checklist'],
      },
      {
        label: 'Access rights review records',
        signals: ['access rights review', 'access recertification'],
      },
      {
        label: 'Privileged access removal evidence',
        signals: ['privileged access removal', 'admin access revocation'],
      },
    ],
    weakSignals: ['access rights'],
    remediation: {
      fix: 'Run quarterly access recertification for production systems and retain the reviewer sign-off.',
      owner: 'Security / IT',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-iso-a5-19',
    code: 'ISO-A.5.19',
    frameworkKey: 'iso27001',
    category: 'Vendor Management',
    name: 'Information Security in Supplier Relationships',
    description:
      'Processes and procedures are defined and implemented to manage the information security risks associated with the use of supplier products and services.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'A maintained supplier inventory lets the risk programme cover every third party with data access.',
    requiredEvidence: [
      {
        label: 'Supplier security requirements',
        signals: ['supplier security', 'vendor risk assessment'],
      },
      {
        label: 'Supplier inventory',
        signals: ['supplier inventory', 'vendor inventory'],
      },
    ],
    weakSignals: ['supplier'],
    remediation: {
      fix: 'Keep the supplier inventory current with tiering, data access and the security baseline required of each tier.',
      owner: 'Procurement / Security',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-iso-a5-20',
    code: 'ISO-A.5.20',
    frameworkKey: 'iso27001',
    category: 'Vendor Management',
    name: 'Addressing Information Security within Supplier Agreements',
    description:
      'Relevant information security requirements are agreed with each supplier and documented in agreements.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Contract evidence is requested during certification audits for every supplier with data access.',
    requiredEvidence: [
      {
        label: 'Signed supplier agreements register',
        signals: ['signed supplier agreement', 'supplier agreement register', 'security addendum'],
      },
      {
        label: 'Data processing agreements',
        signals: ['data processing agreement', 'dpa register'],
      },
    ],
    weakSignals: ['contractual security requirements', 'confidentiality agreement'],
    remediation: {
      fix: 'Add the security addendum to every supplier contract and keep a register of agreements with renewal dates.',
      owner: 'Procurement / Security',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-iso-a5-22',
    code: 'ISO-A.5.22',
    frameworkKey: 'iso27001',
    category: 'Vendor Management',
    name: 'Monitoring, Review and Change Management of Supplier Services',
    description:
      'The organisation regularly monitors, reviews, evaluates and manages changes to supplier information security practices and service delivery.',
    riskLevel: 'medium',
    isPolicyDomain: false,
    rationale:
      'Ongoing supplier monitoring is a distinct requirement from initial due diligence.',
    requiredEvidence: [
      {
        label: 'Supplier service monitoring reports',
        signals: ['supplier service monitoring', 'vendor sla review'],
      },
      {
        label: 'Vendor performance review records',
        signals: ['vendor performance review'],
      },
    ],
    weakSignals: [],
    remediation: {
      fix: 'Schedule annual supplier service reviews with security and SLA outcomes, and log change notifications from tier-1 vendors.',
      owner: 'Procurement / Security',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-iso-a5-24',
    code: 'ISO-A.5.24',
    frameworkKey: 'iso27001',
    category: 'Incident Response',
    name: 'Information Security Incident Management Planning and Preparation',
    description:
      'The organisation plans and prepares for managing information security incidents through defined processes, roles and responsibilities.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Planning artefacts are within scope for readiness even before any incident has occurred.',
    requiredEvidence: [
      {
        label: 'Incident management procedure',
        signals: ['incident response plan', 'incident management procedure'],
      },
      {
        label: 'Incident roles and responsibilities',
        signals: ['incident response team', 'escalation path'],
      },
    ],
    weakSignals: ['incident management'],
    remediation: {
      fix: 'Confirm the incident management procedure names the response team, coverage hours and escalation path.',
      owner: 'Security Operations',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-iso-a5-26',
    code: 'ISO-A.5.26',
    frameworkKey: 'iso27001',
    category: 'Incident Response',
    name: 'Response to Information Security Incidents',
    description:
      'Information security incidents are responded to in accordance with documented procedures, with records retained.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Auditors sample incident records to confirm that the documented process is actually followed.',
    requiredEvidence: [
      {
        label: 'Documented incident response process',
        signals: ['incident response plan', 'containment, eradication and recovery'],
      },
      {
        label: 'Incident records with severity and timeline',
        signals: ['incident register', 'incident log', 'incident ticket'],
      },
      {
        label: 'Post-incident review records',
        signals: ['post-incident review records', 'lessons learned register'],
      },
    ],
    weakSignals: ['post-incident review', 'incident handling'],
    remediation: {
      fix: 'Retain incident records including severity, timeline and post-incident review outcomes.',
      owner: 'Security Operations',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-iso-a5-29',
    code: 'ISO-A.5.29',
    frameworkKey: 'iso27001',
    category: 'Business Continuity',
    name: 'Information Security during Disruption',
    description:
      'The organisation plans how to maintain information security at an appropriate level during disruption.',
    riskLevel: 'high',
    isPolicyDomain: true,
    rationale:
      'Continuity arrangements must be tested to be credible evidence of availability capability.',
    requiredEvidence: [
      {
        label: 'ICT continuity arrangements',
        signals: ['business continuity plan', 'ict continuity'],
      },
      {
        label: 'Continuity test results',
        signals: ['continuity test results', 'disaster recovery test'],
      },
      {
        label: 'Recovery objectives for critical systems',
        signals: ['recovery objectives for critical systems', 'system rto'],
      },
    ],
    weakSignals: ['disaster recovery plan', 'continuity testing'],
    remediation: {
      fix: 'Add system-level recovery objectives to the continuity plan and record the outcome of the annual continuity test.',
      owner: 'Operations',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-iso-a5-34',
    code: 'ISO-A.5.34',
    frameworkKey: 'iso27001',
    category: 'Data Protection',
    name: 'Privacy and Protection of PII',
    description:
      'The organisation identifies and meets requirements regarding the protection of personally identifiable information.',
    riskLevel: 'high',
    isPolicyDomain: true,
    rationale:
      'Privacy requirements must be identifiable in policy and in an inventory of processing activities.',
    requiredEvidence: [
      { label: 'Privacy notice and commitments', signals: ['privacy notice'] },
      {
        label: 'Records of processing / PII inventory',
        signals: ['pii inventory', 'records of processing', 'data inventory'],
      },
    ],
    weakSignals: ['personal data'],
    remediation: {
      fix: 'Maintain a record of processing activities covering lawful basis, retention and location for each PII category.',
      owner: 'Data Protection Lead',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-iso-a5-36',
    code: 'ISO-A.5.36',
    frameworkKey: 'iso27001',
    category: 'Security Policies',
    name: 'Compliance with Policies, Rules and Standards',
    description:
      'Compliance with the organisation’s information security policy and standards is reviewed on a regular basis.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Periodic compliance review closes the loop between written policy and observed practice.',
    requiredEvidence: [
      {
        label: 'Compliance review records',
        signals: ['compliance review', 'internal audit report'],
      },
      {
        label: 'Policy exception register',
        signals: ['policy exception register', 'exception log'],
      },
    ],
    weakSignals: ['compliance with policies', 'regulatory requirements'],
    remediation: {
      fix: 'Perform an annual compliance review against the security policy set and record exceptions with expiry dates.',
      owner: 'Compliance / Security',
      timelineDays: 90,
    },
  },
  {
    id: 'ctl-iso-a6-3',
    code: 'ISO-A.6.3',
    frameworkKey: 'iso27001',
    category: 'Employee Security',
    name: 'Information Security Awareness, Education and Training',
    description:
      'Personnel receive appropriate security awareness education and training, with completion tracked.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Training evidence is a standard first-line request in ISO 27001 certification audits.',
    requiredEvidence: [
      {
        label: 'Security awareness programme',
        signals: ['security awareness training', 'security awareness programme'],
      },
      {
        label: 'Training completion records',
        signals: ['training completion records'],
      },
    ],
    weakSignals: ['awareness'],
    remediation: {
      fix: 'Assign role-based security training at onboarding and annually, retaining completion reports.',
      owner: 'People Ops / Security',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-iso-a5-9',
    code: 'ISO-A.5.9',
    frameworkKey: 'iso27001',
    category: 'Asset Management',
    name: 'Inventory of Information and Other Associated Assets',
    description:
      'An inventory of information and other associated assets, including their owners, is established, maintained and reviewed.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale: 'Nothing else in the control set is actionable until you know which assets exist and who owns them.',
    requiredEvidence: [
      {
        label: 'Information asset inventory',
        signals: ['inventory of information assets', 'information asset inventory'],
      },
      {
        label: 'Asset owners recorded',
        signals: ['asset owners are recorded', 'asset owners'],
      },
    ],
    weakSignals: ['asset inventory', 'asset register'],
    remediation: {
      fix: 'Publish the asset register with an owner and classification per system or service, then review it on a fixed cadence.',
      owner: 'IT Operations / Security',
      timelineDays: 45,
    },
  },
  {
    id: 'ctl-iso-a8-2',
    code: 'ISO-A.8.2',
    frameworkKey: 'iso27001',
    category: 'Access Control',
    name: 'Privileged Access Rights',
    description:
      'The allocation and use of privileged access rights is restricted and managed.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Privileged accounts carry the greatest impact if misplaced, so inventory and review evidence is expected.',
    requiredEvidence: [
      {
        label: 'Privileged access standard',
        signals: ['privileged access standard', 'administrative accounts'],
      },
      {
        label: 'Privileged account inventory',
        signals: ['privileged account inventory', 'pam solution', 'privileged access review'],
      },
      {
        label: 'Privileged session logging',
        signals: ['privileged session logging', 'session recording'],
      },
    ],
    weakSignals: ['privileged accounts'],
    remediation: {
      fix: 'Maintain a privileged account inventory with review cadence, and record privileged session activity.',
      owner: 'Security / IT',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-iso-a8-3',
    code: 'ISO-A.8.3',
    frameworkKey: 'iso27001',
    category: 'Data Protection',
    name: 'Information Access Restriction',
    description:
      'Access to information and other associated assets is restricted in accordance with the established topic-specific policy on access control.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Restriction needs to be enforced and evidenced, not only stated as an intention.',
    requiredEvidence: [
      {
        label: 'Information access restriction policy',
        signals: ['access restriction policy', 'need-to-know'],
      },
      {
        label: 'Information access matrix',
        signals: ['information access matrix', 'access control matrix'],
      },
      {
        label: 'Access enforcement configuration evidence',
        signals: ['access enforcement', 'permission configuration export'],
      },
    ],
    weakSignals: ['access restriction'],
    remediation: {
      fix: 'Publish an access matrix per information domain and retain configuration exports that demonstrate enforcement.',
      owner: 'Data Protection Lead',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-iso-a8-8',
    code: 'ISO-A.8.8',
    frameworkKey: 'iso27001',
    category: 'Monitoring',
    name: 'Management of Technical Vulnerabilities',
    description:
      'Information about technical vulnerabilities of information systems in use is obtained, exposure is evaluated and appropriate measures are taken.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'A scanning habit without a documented procedure and retained results is a recurring audit finding.',
    requiredEvidence: [
      {
        label: 'Vulnerability management procedure',
        signals: ['vulnerability management procedure'],
      },
      {
        label: 'Vulnerability scan reports',
        signals: ['vulnerability scan report'],
      },
    ],
    weakSignals: ['vulnerability scanning', 'vulnerability scan'],
    remediation: {
      fix: 'Document the vulnerability management procedure with scan cadence, risk-based remediation SLAs and retained reports.',
      owner: 'Security Operations',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-iso-a8-10',
    code: 'ISO-A.8.10',
    frameworkKey: 'iso27001',
    category: 'Data Protection',
    name: 'Information Deletion',
    description:
      'Information stored in information systems, devices or other storage media is deleted when no longer required.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Retention and deletion requirements are frequently referenced in customer data agreements.',
    requiredEvidence: [
      {
        label: 'Secure deletion procedure',
        signals: ['secure deletion', 'data disposal'],
      },
      { label: 'Retention schedule', signals: ['data retention'] },
    ],
    weakSignals: ['deletion'],
    remediation: {
      fix: 'Define retention periods per information class and retain deletion reports for scheduled purges.',
      owner: 'Data Protection Lead',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-iso-a8-13',
    code: 'ISO-A.8.13',
    frameworkKey: 'iso27001',
    category: 'Backup',
    name: 'Information Backup',
    description:
      'Backup copies of information, software and systems are maintained and tested in accordance with the backup policy.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Restore testing is the only way to demonstrate that backups are usable during an incident.',
    requiredEvidence: [
      {
        label: 'Backup policy and schedule',
        signals: ['backup policy', 'backup schedule'],
      },
      {
        label: 'Restore test results',
        signals: ['restore test results', 'restore test report'],
      },
      {
        label: 'Backup monitoring and alerting',
        signals: ['backup monitoring', 'backup job alerting'],
      },
    ],
    weakSignals: ['restore testing', 'backup verification'],
    remediation: {
      fix: 'Perform and document a restore test at least quarterly and retain the result alongside the backup schedule.',
      owner: 'Infrastructure',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-iso-a8-14',
    code: 'ISO-A.8.14',
    frameworkKey: 'iso27001',
    category: 'Business Continuity',
    name: 'Redundancy of Information Processing Facilities',
    description:
      'Information processing facilities are implemented with redundancy sufficient to meet availability requirements.',
    riskLevel: 'medium',
    isPolicyDomain: false,
    rationale:
      'Redundancy claims in customer contracts need architecture evidence and failover validation.',
    requiredEvidence: [
      {
        label: 'Redundancy architecture documentation',
        signals: ['redundancy architecture', 'multi-az deployment'],
      },
      { label: 'Failover test evidence', signals: ['failover test'] },
    ],
    weakSignals: ['redundancy', 'high availability'],
    remediation: {
      fix: 'Document the redundancy architecture per critical service and record a scheduled failover exercise.',
      owner: 'Infrastructure',
      timelineDays: 90,
    },
  },
  {
    id: 'ctl-iso-a8-15',
    code: 'ISO-A.8.15',
    frameworkKey: 'iso27001',
    category: 'Logging',
    name: 'Logging',
    description:
      'Logs that record activities, exceptions, faults and other relevant events are produced, stored, protected and analysed.',
    riskLevel: 'critical',
    isPolicyDomain: false,
    rationale:
      'Logging is the foundation for detection, investigation and evidence retention.',
    requiredEvidence: [
      {
        label: 'Logging standard and retained log sources',
        signals: ['logging standard', 'log retention'],
      },
      { label: 'Log review evidence', signals: ['log review'] },
    ],
    weakSignals: [],
    remediation: {
      fix: 'Publish a logging standard defining log sources, retention and protection, then retain periodic log review evidence.',
      owner: 'Security Operations',
      timelineDays: 45,
    },
  },
  {
    id: 'ctl-iso-a8-16',
    code: 'ISO-A.8.16',
    frameworkKey: 'iso27001',
    category: 'Monitoring',
    name: 'Monitoring Activities',
    description:
      'Networks, systems and applications are monitored for anomalous behaviour, with results acted upon.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Monitoring must be continuous and evidenced, rather than reactive to customer reports.',
    requiredEvidence: [
      {
        label: 'Monitoring activities and responsibilities',
        signals: ['monitoring activities', 'soc monitoring'],
      },
      {
        label: 'Centralised monitoring platform',
        signals: ['centralised monitoring', 'monitoring platform'],
      },
    ],
    weakSignals: [],
    remediation: {
      fix: 'Define monitoring scope, ownership and alert thresholds, and retain evidence of triage and follow-up.',
      owner: 'Security Operations',
      timelineDays: 45,
    },
  },
  {
    id: 'ctl-iso-a8-32',
    code: 'ISO-A.8.32',
    frameworkKey: 'iso27001',
    category: 'Change Management',
    name: 'Change Management',
    description:
      'Changes to information processing facilities and systems are subject to change management procedures.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Change records are sampled heavily during certification audits, especially for production systems.',
    requiredEvidence: [
      {
        label: 'Change management procedure',
        signals: ['change management procedure', 'change control procedure'],
      },
      {
        label: 'Change approval records',
        signals: ['change advisory board', 'cab approval', 'change request approval'],
      },
      {
        label: 'Change testing evidence',
        signals: ['change testing', 'release verification'],
      },
    ],
    weakSignals: [],
    remediation: {
      fix: 'Document the change procedure with approval gates and testing requirements, then retain records for each production change.',
      owner: 'Engineering',
      timelineDays: 45,
    },
  },
];
