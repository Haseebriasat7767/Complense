/**
 * SOC 2 Trust Services Criteria — demo control library (28 controls).
 *
 * The demo library is a realistic subset of the 2017 TSC (2022 revision)
 * criteria used for readiness review. Each control declares the evidence items
 * the analysis engine expects and the literal phrases ("signals") it looks for
 * in extracted evidence text. Analysis is fully deterministic: the same
 * evidence always produces the same result.
 *
 * Demo data — not a licensed reproduction of AICPA criteria text.
 */
import type { ControlDefinition } from './types.js';

export const SOC2_CONTROLS: ControlDefinition[] = [
  {
    id: 'ctl-soc2-cc1-1',
    code: 'SOC2-CC1.1',
    frameworkKey: 'soc2',
    category: 'Security Policies',
    name: 'Integrity and Ethical Values',
    description:
      'The organisation demonstrates a commitment to integrity and ethical values through documented standards of conduct and a means to report concerns.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Auditors look for a board-approved code of conduct and a reporting channel that personnel know how to use.',
    requiredEvidence: [
      { label: 'Code of conduct', signals: ['code of conduct'] },
      {
        label: 'Whistleblower / ethics reporting channel',
        signals: ['whistleblower', 'ethics hotline', 'speak-up line'],
      },
    ],
    weakSignals: ['ethical values'],
    remediation: {
      fix: 'Publish the code of conduct in the security policy portal and record annual acknowledgements.',
      owner: 'Compliance / Security',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-soc2-cc1-2',
    code: 'SOC2-CC1.2',
    frameworkKey: 'soc2',
    category: 'Security Policies',
    name: 'Board Independence and Oversight',
    description:
      'Management establishes oversight structures with defined authority and responsibility for the security programme.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Oversight evidence shows accountability for the control environment sits above the operational team.',
    requiredEvidence: [
      {
        label: 'Governance structure and security committee',
        signals: ['security steering committee', 'governance structure'],
      },
      {
        label: 'Management oversight and review records',
        signals: ['management oversight', 'quarterly management review'],
      },
    ],
    weakSignals: ['board oversight'],
    remediation: {
      fix: 'Document the security steering committee charter, membership and quarterly review minutes.',
      owner: 'Compliance / Security',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-soc2-cc1-3',
    code: 'SOC2-CC1.3',
    frameworkKey: 'soc2',
    category: 'Security Policies',
    name: 'Roles, Responsibilities and Reporting Lines',
    description:
      'Responsibilities for security are assigned to defined roles with documented reporting lines across the organisation.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Without explicit role assignments, control ownership is ambiguous during audit walkthroughs.',
    requiredEvidence: [
      {
        label: 'Organisational chart or RACI matrix',
        signals: ['organisational chart', 'organizational chart', 'raci'],
      },
      {
        label: 'Documented role assignments',
        signals: ['role assignment register', 'reporting lines', 'responsibility matrix'],
      },
    ],
    weakSignals: ['security roles and responsibilities', 'roles and responsibilities'],
    remediation: {
      fix: 'Publish an organisational chart with security role owners and a RACI covering access, change and incident processes.',
      owner: 'People Ops / Security',
      timelineDays: 45,
    },
  },
  {
    id: 'ctl-soc2-cc1-4',
    code: 'SOC2-CC1.4',
    frameworkKey: 'soc2',
    category: 'Employee Security',
    name: 'Competence and Security Training',
    description:
      'Personnel are trained to perform their security responsibilities, with completion tracked for the whole workforce.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Training records are one of the first population samples an auditor requests for the period.',
    requiredEvidence: [
      {
        label: 'Security awareness training programme',
        signals: ['security awareness training', 'annual security training'],
      },
      {
        label: 'Training completion records',
        signals: ['training completion records', 'training completion rate'],
      },
    ],
    weakSignals: ['awareness programme'],
    remediation: {
      fix: 'Automate quarterly awareness assignments and export completion records for the audit period.',
      owner: 'People Ops / Security',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-soc2-cc2-1',
    code: 'SOC2-CC2.1',
    frameworkKey: 'soc2',
    category: 'Data Protection',
    name: 'Information Quality and Classification',
    description:
      'Information used to operate controls is accurate, complete, timely and classified according to sensitivity.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Classification drives handling, retention and encryption decisions across the control set.',
    requiredEvidence: [
      {
        label: 'Data classification standard',
        signals: ['data classification', 'classification standard'],
      },
      {
        label: 'Information handling requirements',
        signals: ['information handling', 'handling requirements'],
      },
    ],
    weakSignals: ['data quality'],
    remediation: {
      fix: 'Define classification levels and apply handling requirements to each system of record.',
      owner: 'Data Protection Lead',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-soc2-cc2-2',
    code: 'SOC2-CC2.2',
    frameworkKey: 'soc2',
    category: 'Employee Security',
    name: 'Internal Communication of Security Objectives',
    description:
      'Security objectives and responsibilities are communicated to personnel, with acknowledgement evidence retained.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Communication evidence links written policy to workforce behaviour for control operation.',
    requiredEvidence: [
      {
        label: 'Security awareness communications',
        signals: ['security awareness', 'awareness communications'],
      },
      {
        label: 'Policy acknowledgement records',
        signals: ['policy acknowledgement', 'acceptable use acknowledgement', 'attestation'],
      },
    ],
    weakSignals: ['internal communication'],
    remediation: {
      fix: 'Track policy acknowledgements in the HR platform and report completion to the security steering committee.',
      owner: 'People Ops / Security',
      timelineDays: 45,
    },
  },
  {
    id: 'ctl-soc2-cc2-3',
    code: 'SOC2-CC2.3',
    frameworkKey: 'soc2',
    category: 'Security Policies',
    name: 'External Communication',
    description:
      'The organisation communicates its security commitments and notification obligations to customers and regulators.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Customer-facing commitments must match the controls actually operated, otherwise scope gaps appear.',
    requiredEvidence: [
      {
        label: 'External commitments and privacy notice',
        signals: ['privacy notice', 'customer commitments'],
      },
      {
        label: 'Customer notification procedures',
        signals: ['customer notification', 'breach notification'],
      },
    ],
    weakSignals: ['external communication'],
    remediation: {
      fix: 'Publish the security commitments page and align contractual notification windows with the incident response plan.',
      owner: 'Compliance / Security',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-soc2-cc3-1',
    code: 'SOC2-CC3.1',
    frameworkKey: 'soc2',
    category: 'Risk Management',
    name: 'Risk Objectives and Business Impact',
    description:
      'Risk appetite and objectives are specified, with business impact analysis for critical processes.',
    riskLevel: 'high',
    isPolicyDomain: true,
    rationale:
      'The risk programme sets tolerance levels that the rest of the control library is tested against.',
    requiredEvidence: [
      {
        label: 'Risk appetite and objectives',
        signals: ['risk appetite', 'risk objectives', 'risk tolerance'],
      },
      {
        label: 'Business impact analysis',
        signals: ['business impact analysis', 'critical business processes'],
      },
    ],
    weakSignals: ['risk framework'],
    remediation: {
      fix: 'Refresh the business impact analysis annually and map each critical process to recovery objectives.',
      owner: 'Risk Committee',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-soc2-cc3-2',
    code: 'SOC2-CC3.2',
    frameworkKey: 'soc2',
    category: 'Risk Management',
    name: 'Risk Identification and Analysis',
    description:
      'Risks to the achievement of objectives are identified, analysed and recorded with owners and treatment plans.',
    riskLevel: 'high',
    isPolicyDomain: true,
    rationale:
      'The risk register is the bridge between business risk and control selection during readiness review.',
    requiredEvidence: [
      { label: 'Risk register', signals: ['risk register', 'risk log'] },
      {
        label: 'Risk assessment methodology',
        signals: ['risk assessment methodology', 'likelihood and impact'],
      },
    ],
    weakSignals: ['risk assessment', 'annual risk review'],
    remediation: {
      fix: 'Consolidate findings into a maintained risk register with scoring methodology, owners and review cadence.',
      owner: 'Risk Committee',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-soc2-cc3-3',
    code: 'SOC2-CC3.3',
    frameworkKey: 'soc2',
    category: 'Risk Management',
    name: 'Fraud Risk Assessment',
    description:
      'The organisation considers the potential for fraud when assessing risks to objectives.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Fraud risk is a standalone criterion and is commonly missed in first readiness reviews.',
    requiredEvidence: [
      {
        label: 'Fraud risk assessment',
        signals: ['fraud risk assessment', 'fraud risk register'],
      },
      {
        label: 'Management review of fraud risk',
        signals: ['management review of fraud', 'fraud monitoring'],
      },
    ],
    weakSignals: ['fraud'],
    remediation: {
      fix: 'Add a fraud scenario workshop to the annual risk cycle and record conclusions in the risk register.',
      owner: 'Risk Committee',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-soc2-cc3-4',
    code: 'SOC2-CC3.4',
    frameworkKey: 'soc2',
    category: 'Risk Management',
    name: 'Risk Assessment of Significant Changes',
    description:
      'Significant changes to the environment are assessed for new or changed risks before implementation.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Change-driven risk assessment keeps the risk profile current as the environment evolves.',
    requiredEvidence: [
      {
        label: 'Risk re-assessment triggers',
        signals: ['risk re-assessment triggers', 'reassessment triggers'],
      },
      {
        label: 'Vendor and platform change review',
        signals: ['vendor risk re-assessment', 'change review criteria'],
      },
    ],
    weakSignals: ['significant change'],
    remediation: {
      fix: 'Define explicit triggers that reopen risk assessment (new vendor, new region, material architecture change).',
      owner: 'Risk Committee',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-soc2-cc4-1',
    code: 'SOC2-CC4.1',
    frameworkKey: 'soc2',
    category: 'Monitoring',
    name: 'Control Evaluation and Monitoring',
    description:
      'Evaluations are performed to confirm that controls are present and operating effectively.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Ongoing evaluation is the evidence that monitoring is deliberate rather than incidental.',
    requiredEvidence: [
      {
        label: 'Control testing schedule',
        signals: ['control testing schedule', 'control review calendar'],
      },
      {
        label: 'Control monitoring review records',
        signals: ['control monitoring review', 'annual control review'],
      },
    ],
    weakSignals: ['internal review'],
    remediation: {
      fix: 'Create a control testing calendar with named owners and retain the completed review records per cycle.',
      owner: 'Security Operations',
      timelineDays: 45,
    },
  },
  {
    id: 'ctl-soc2-cc4-2',
    code: 'SOC2-CC4.2',
    frameworkKey: 'soc2',
    category: 'Monitoring',
    name: 'Remediation of Deficiencies',
    description:
      'Deficiencies identified in control operation are communicated and remediated in a timely manner.',
    riskLevel: 'medium',
    isPolicyDomain: false,
    rationale:
      'Closed-loop remediation evidence demonstrates that findings are actually acted upon.',
    requiredEvidence: [
      {
        label: 'Post-incident review process',
        signals: ['post-incident review', 'lessons learned'],
      },
      {
        label: 'Corrective action tracking',
        signals: ['corrective action', 'remediation tracking'],
      },
    ],
    weakSignals: ['deficiency'],
    remediation: {
      fix: 'Log every finding in a tracker with owner, due date and verification evidence.',
      owner: 'Security Operations',
      timelineDays: 45,
    },
  },
  {
    id: 'ctl-soc2-cc5-1',
    code: 'SOC2-CC5.1',
    frameworkKey: 'soc2',
    category: 'Security Policies',
    name: 'Control Selection and Development',
    description:
      'Controls are selected and developed in response to assessed risks, with a documented control set.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'A documented control set lets an auditor trace each criterion to an implemented control.',
    requiredEvidence: [
      {
        label: 'Documented control framework',
        signals: ['control framework', 'security control set'],
      },
      {
        label: 'Risk-based control selection',
        signals: ['risk-based control selection', 'controls mapped to risks'],
      },
    ],
    weakSignals: ['control library'],
    remediation: {
      fix: 'Maintain a control matrix linking each criterion to the control owner and supporting evidence.',
      owner: 'Compliance / Security',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-soc2-cc6-1',
    code: 'SOC2-CC6.1',
    frameworkKey: 'soc2',
    category: 'Access Control',
    name: 'Logical Access Security Measures',
    description:
      'Logical access to systems and data is restricted through documented access controls, periodic reviews and provisioning records.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Access reviews are the most frequently requested population sample in a SOC 2 examination.',
    requiredEvidence: [
      {
        label: 'Access control policy',
        signals: ['access control policy', 'logical access'],
      },
      {
        label: 'Periodic access reviews',
        signals: ['user access review', 'periodic access review', 'quarterly access review'],
      },
      {
        label: 'Access provisioning records',
        signals: ['access provisioning records', 'provisioning evidence'],
      },
    ],
    weakSignals: ['access management', 'two-factor authentication', 'access restrictions', 'credentials', 'accessed corporate github credentials'],
    remediation: {
      fix: 'Document and perform quarterly user-access reviews, retaining the reviewer, population and outcome for each cycle.',
      owner: 'Security / IT',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-soc2-cc6-2',
    code: 'SOC2-CC6.2',
    frameworkKey: 'soc2',
    category: 'Identity',
    name: 'User Registration and Authorization',
    description:
      'New users are registered and authorised before access is granted, based on documented approval.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Provisioning approvals demonstrate that access is granted deliberately, not by default.',
    requiredEvidence: [
      {
        label: 'User provisioning workflow',
        signals: ['user provisioning workflow', 'provisioning request'],
      },
      {
        label: 'Authorisation and approval evidence',
        signals: ['manager approval', 'approval matrix'],
      },
    ],
    weakSignals: ['onboarding access', 'two-factor authentication', 'multi-factor authentication', 'mfa', 'github credentials', 'login information'],
    remediation: {
      fix: 'Route all access requests through the ticketing queue with manager approval recorded before provisioning.',
      owner: 'Security / IT',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-soc2-cc6-3',
    code: 'SOC2-CC6.3',
    frameworkKey: 'soc2',
    category: 'Access Control',
    name: 'Role-Based Access and Least Privilege',
    description:
      'Access is granted on a least-privilege basis and aligned to defined roles and responsibilities.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Least privilege reduces the blast radius of a compromised account and is verified during walkthroughs.',
    requiredEvidence: [
      {
        label: 'Role-based access control model',
        signals: ['role-based access control', 'rbac'],
      },
      { label: 'Least privilege standard', signals: ['least privilege'] },
    ],
    weakSignals: ['segregation of duties'],
    remediation: {
      fix: 'Define role templates per system and enforce least privilege through group membership rather than direct grants.',
      owner: 'Security / IT',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-soc2-cc6-5',
    code: 'SOC2-CC6.5',
    frameworkKey: 'soc2',
    category: 'Data Protection',
    name: 'Data and Asset Disposal',
    description:
      'Logical and physical protections over data are removed only through documented disposal processes.',
    riskLevel: 'medium',
    isPolicyDomain: true,
    rationale:
      'Disposal evidence prevents customer data from surviving decommissioning activities.',
    requiredEvidence: [
      {
        label: 'Retention and disposal standard',
        signals: ['data retention', 'secure disposal', 'data disposal'],
      },
      {
        label: 'Secure deletion evidence',
        signals: ['secure deletion', 'certificate of destruction'],
      },
    ],
    weakSignals: ['decommissioning'],
    remediation: {
      fix: 'Attach deletion certificates to decommissioning tickets and reconcile the asset register quarterly.',
      owner: 'Data Protection Lead',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-soc2-cc6-6',
    code: 'SOC2-CC6.6',
    frameworkKey: 'soc2',
    category: 'Access Control',
    name: 'Boundary Protection',
    description:
      'The organisation protects against threats originating outside its system boundaries.',
    riskLevel: 'medium',
    isPolicyDomain: false,
    rationale:
      'Auditors verify boundary rules exist as configured, not only as described in policy.',
    requiredEvidence: [
      {
        label: 'Network boundary protection standard',
        signals: ['network boundary protection'],
      },
      {
        label: 'Firewall and security group configuration evidence',
        signals: ['firewall ruleset export', 'security group configuration', 'boundary rule review'],
      },
    ],
    weakSignals: ['network segmentation'],
    remediation: {
      fix: 'Export firewall and security-group rules on a quarterly cadence and retain the review sign-off with the export.',
      owner: 'Infrastructure',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-soc2-cc6-7',
    code: 'SOC2-CC6.7',
    frameworkKey: 'soc2',
    category: 'Data Protection',
    name: 'Transmission, Movement and Encryption',
    description:
      'Data is protected in transit and at rest, and encryption keys are managed through a defined process.',
    riskLevel: 'high',
    isPolicyDomain: true,
    rationale:
      'Encryption configuration is verified against production systems, not just policy statements.',
    requiredEvidence: [
      {
        label: 'Encryption in transit standard',
        signals: ['encryption in transit', 'tls 1.2', 'tls 1.3'],
      },
      { label: 'Key management process', signals: ['key management', 'key rotation'] },
    ],
    weakSignals: ['encryption requirements'],
    remediation: {
      fix: 'Record TLS minimums and key rotation intervals in the encryption standard and validate them in configuration reviews.',
      owner: 'Data Protection Lead',
      timelineDays: 45,
    },
  },
  {
    id: 'ctl-soc2-cc6-8',
    code: 'SOC2-CC6.8',
    frameworkKey: 'soc2',
    category: 'Monitoring',
    name: 'Malicious Software Prevention',
    description:
      'Controls prevent or detect the introduction of malicious software on assets that support the service.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Endpoint coverage and alerting evidence demonstrate protection across the asset population.',
    requiredEvidence: [
      {
        label: 'Endpoint protection standard',
        signals: ['endpoint protection', 'edr', 'antivirus'],
      },
      {
        label: 'Endpoint monitoring and alerting',
        signals: ['endpoint monitoring', 'edr console', 'malware alerting'],
      },
    ],
    weakSignals: ['malware'],
    remediation: {
      fix: 'Track EDR agent coverage against the asset register and retain malware alert triage records.',
      owner: 'Security Operations',
      timelineDays: 45,
    },
  },
  {
    id: 'ctl-soc2-cc7-1',
    code: 'SOC2-CC7.1',
    frameworkKey: 'soc2',
    category: 'Monitoring',
    name: 'Vulnerability and Configuration Monitoring',
    description:
      'The organisation detects configuration changes and vulnerabilities that introduce risk to the environment.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'A scanning cadence without retained reports leaves the control unverifiable.',
    requiredEvidence: [
      {
        label: 'Vulnerability management procedure',
        signals: ['vulnerability management procedure', 'patch management policy'],
      },
      {
        label: 'Vulnerability scan reports',
        signals: ['vulnerability scan report', 'scan findings register'],
      },
    ],
    weakSignals: ['vulnerability scanning', 'vulnerability scan', 'patch cadence'],
    remediation: {
      fix: 'Formalise the vulnerability management procedure with scan cadence, triage SLAs and retained reports.',
      owner: 'Security Operations',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-soc2-cc7-2',
    code: 'SOC2-CC7.2',
    frameworkKey: 'soc2',
    category: 'Logging',
    name: 'Security Monitoring and Anomaly Detection',
    description:
      'Security events are monitored and anomalies are identified through centralised logging and alerting.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Without centralised logging and alert triage, detection depends on individuals noticing problems.',
    requiredEvidence: [
      {
        label: 'Centralised logging / SIEM configuration',
        signals: ['siem', 'security monitoring platform', 'log aggregation', 'centralised logging'],
      },
      {
        label: 'Alert triage records',
        signals: ['alert triage', 'monitoring alert records', 'detection alert review'],
      },
    ],
    weakSignals: ['log sources', 'insufficient monitoring', 'monitoring', 'logs', 'logging', 'security incident', 'breach', 'attacker'],
    remediation: {
      fix: 'Centralise application, identity and infrastructure logs with alert rules for privileged activity and retain triage records.',
      owner: 'Security Operations',
      timelineDays: 45,
    },
  },
  {
    id: 'ctl-soc2-cc7-3',
    code: 'SOC2-CC7.3',
    frameworkKey: 'soc2',
    category: 'Incident Response',
    name: 'Incident Response Testing',
    description:
      'Incident response procedures are tested and lessons learned are fed back into the plan.',
    riskLevel: 'medium',
    isPolicyDomain: false,
    rationale:
      'Untested plans are a common gap: auditing teams ask for the last exercise and its findings.',
    requiredEvidence: [
      { label: 'Incident response plan', signals: ['incident response plan'] },
      {
        label: 'Incident response test results',
        signals: ['tabletop exercise results', 'incident response test results', 'test findings register'],
      },
      {
        label: 'Incident handling records',
        signals: ['incident register', 'incident log', 'incident ticket'],
      },
    ],
    weakSignals: ['tabletop exercise', 'incident response testing', 'security incident', 'breach', 'attacker', 'exposed credentials', 'incident involved'],
    remediation: {
      fix: 'Run and document at least one tabletop or live exercise per year, and retain incident records with dates and severity.',
      owner: 'Security Operations',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-soc2-cc7-4',
    code: 'SOC2-CC7.4',
    frameworkKey: 'soc2',
    category: 'Incident Response',
    name: 'Incident Response Execution',
    description:
      'Incidents are contained, remediated and communicated following a defined classification and escalation model.',
    riskLevel: 'high',
    isPolicyDomain: true,
    rationale:
      'The plan itself is evidence that response activities are defined before an incident occurs.',
    requiredEvidence: [
      {
        label: 'Incident classification and severity levels',
        signals: ['incident classification', 'severity levels', 'severity matrix'],
      },
      {
        label: 'Containment, eradication and recovery steps',
        signals: ['containment, eradication and recovery', 'containment and recovery'],
      },
      {
        label: 'Incident roles and communication path',
        signals: ['incident response team', 'escalation path', 'incident communication'],
      },
    ],
    weakSignals: ['incident handling'],
    remediation: {
      fix: 'Keep severity definitions current and rehearse escalation paths with the on-call roster.',
      owner: 'Security Operations',
      timelineDays: 30,
    },
  },
  {
    id: 'ctl-soc2-cc8-1',
    code: 'SOC2-CC8.1',
    frameworkKey: 'soc2',
    category: 'Change Management',
    name: 'Change Management',
    description:
      'Changes to infrastructure, data, software and procedures are authorised, designed, tested and approved.',
    riskLevel: 'high',
    isPolicyDomain: false,
    rationale:
      'Change management is the largest sample population in most SOC 2 audits.',
    requiredEvidence: [
      {
        label: 'Change management procedure',
        signals: ['change management procedure', 'change management policy'],
      },
      {
        label: 'Change approval records',
        signals: ['change approval', 'change advisory board', 'cab approval'],
      },
      {
        label: 'Change testing evidence',
        signals: ['change testing', 'post-change verification'],
      },
    ],
    weakSignals: ['change control'],
    remediation: {
      fix: 'Document the change procedure with approval gates, testing requirements and retained evidence in the ticket system.',
      owner: 'Engineering',
      timelineDays: 45,
    },
  },
  {
    id: 'ctl-soc2-cc9-1',
    code: 'SOC2-CC9.1',
    frameworkKey: 'soc2',
    category: 'Business Continuity',
    name: 'Business Disruption Risk Mitigation',
    description:
      'The organisation identifies and mitigates risks arising from business disruption.',
    riskLevel: 'high',
    isPolicyDomain: true,
    rationale:
      'Availability commitments in customer contracts depend on tested continuity arrangements.',
    requiredEvidence: [
      { label: 'Business continuity plan', signals: ['business continuity plan'] },
      {
        label: 'Recovery strategies and objectives',
        signals: ['recovery strategies', 'recovery time objective', 'rto', 'rpo'],
      },
    ],
    weakSignals: [],
    remediation: {
      fix: 'Map each critical process to a recovery objective and validate the plan with an annual exercise.',
      owner: 'Operations',
      timelineDays: 60,
    },
  },
  {
    id: 'ctl-soc2-cc9-2',
    code: 'SOC2-CC9.2',
    frameworkKey: 'soc2',
    category: 'Vendor Management',
    name: 'Vendor and Business Partner Risk Management',
    description:
      'Risks associated with vendors and business partners are assessed and monitored throughout the relationship.',
    riskLevel: 'high',
    isPolicyDomain: true,
    rationale:
      'Vendor reviews are examined as an ongoing control, not a one-time onboarding step.',
    requiredEvidence: [
      {
        label: 'Vendor risk management process',
        signals: ['vendor risk assessment', 'third-party risk'],
      },
      {
        label: 'Annual vendor reviews',
        signals: ['annual vendor review', 'vendor review records', 'vendor re-assessment'],
      },
      {
        label: 'Vendor security questionnaires',
        signals: ['vendor security questionnaire'],
      },
    ],
    weakSignals: ['vendor management'],
    remediation: {
      fix: 'Establish a periodic vendor review cycle with security questionnaire refresh and record the outcome for each tier-1 vendor.',
      owner: 'Procurement / Security',
      timelineDays: 30,
    },
  },
];
