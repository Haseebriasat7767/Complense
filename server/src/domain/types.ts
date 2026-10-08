/**
 * Domain model shared by the store, the analysis engine and the API layer.
 * These types are mirrored by the client in `client/src/lib/types.ts`.
 */

export type FrameworkKey = 'soc2' | 'iso27001';

export type ControlStatus = 'passed' | 'needs_attention' | 'missing' | 'needs_review';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export type EvidenceAnalysisStatus = 'analyzed' | 'analyzing' | 'needs_review' | 'failed';

export type EvidenceSource = 'demo' | 'upload';

export type PlanTier = 'starter' | 'growth' | 'business';

export type UserRole = 'owner' | 'admin' | 'member';

/**
 * A single piece of evidence a control expects. `signals` are the deterministic
 * phrases the analysis engine looks for in extracted evidence text; a required
 * item counts as satisfied when at least one signal is present.
 */
export type RequiredEvidenceItem = {
  label: string;
  signals: string[];
};

export type ControlDefinition = {
  id: string;
  code: string;
  frameworkKey: FrameworkKey;
  category: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  /** Domains where policy documentation alone is considered supporting evidence. */
  isPolicyDomain: boolean;
  requiredEvidence: RequiredEvidenceItem[];
  /** Phrases that indicate the topic is mentioned but not evidenced → NEEDS_REVIEW. */
  weakSignals: string[];
  /** Why this control matters — shown on the control detail page. */
  rationale: string;
  /** Default remediation guidance (used by the deterministic engine). */
  remediation: {
    fix: string;
    owner: string;
    timelineDays: number;
  };
};

export type FrameworkDefinition = {
  key: FrameworkKey;
  name: string;
  shortName: string;
  version: string;
  description: string;
  intent: string;
  readinessLabel: string;
  controlCount: number;
};

export type EvidenceRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  fileName: string;
  fileExtension: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  source: EvidenceSource;
  sourceRef?: string;
  uploadedAt: string;
  uploadedBy: string;
  status: EvidenceAnalysisStatus;
  frameworkKeys: FrameworkKey[];
  /** Simulated/extracted text used by the mapping engine. */
  content: string;
  summary: string;
  sizeOnDisk?: number;
  createdByUser?: string;
};

export type EvidenceInput = Omit<EvidenceRecord, 'id'> & { id?: string };

/** Evidence → control link produced by the analysis engine. */
export type MappingEntry = {
  controlId: string;
  controlCode: string;
  controlName: string;
  frameworkKey: FrameworkKey;
  category: string;
  confidence: number;
  matchedItems: string[];
  missingItems: string[];
};

export type ControlAssessment = {
  controlId: string;
  controlCode: string;
  frameworkKey: FrameworkKey;
  category: string;
  name: string;
  riskLevel: RiskLevel;
  status: ControlStatus;
  confidence: number;
  requiredItems: RequiredEvidenceItem[];
  matchedItems: string[];
  missingItems: string[];
  evidenceIds: string[];
  analysisNote: string;
  updatedAt: string;
};

export type FindingStatus = 'open' | 'planned' | 'resolved';

export type Finding = {
  id: string;
  controlId: string;
  controlCode: string;
  controlName: string;
  frameworkKey: FrameworkKey;
  category: string;
  riskLevel: RiskLevel;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: FindingStatus;
  title: string;
  finding: string;
  evidenceFound: Array<{ evidenceId: string; fileName: string }>;
  evidenceMissing: string[];
  recommendation: {
    fix: string;
    owner: string;
    timelineDays: number;
    timelineLabel: string;
    priorityNote: string;
  };
  aiGenerated: boolean;
  detectedAt: string;
  controlStatus: ControlStatus;
};

export type ReadinessComponent = {
  key: 'controlHealth' | 'evidenceCoverage' | 'evidenceDepth' | 'remediationCoverage';
  label: string;
  weight: number;
  value: number;
  weighted: number;
  description: string;
};

export type ReadinessScore = {
  index: number;
  band: 'strong' | 'moderate' | 'at_risk' | 'critical';
  bandLabel: string;
  components: ReadinessComponent[];
  counts: {
    total: number;
    reviewed: number;
    passed: number;
    needsAttention: number;
    missing: number;
    needsReview: number;
  };
  openFindings: number;
  methodology: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: PlanTier;
  primaryFramework: FrameworkKey;
  industry: string;
  employeeCount: number;
  createdAt: string;
  settings: {
    defaultFramework: FrameworkKey;
    monthlyDigest: boolean;
    gapAlerts: boolean;
    reportReadyEmails: boolean;
    uploadNotifications: boolean;
    mfaRequired: boolean;
    sessionTimeoutMinutes: number;
    allowedUploadTypes: string[];
    retentionDays: number;
  };
};

export type Workspace = {
  id: string;
  organizationId: string;
  name: string;
  isDemo: boolean;
  isDefault: boolean;
  createdAt: string;
  ownerUserId: string;
};

export type User = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  jobTitle: string;
  role: UserRole;
  isDemoUser: boolean;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
};

export type ReportStatus = 'generating' | 'ready' | 'failed';

/**
 * Compact control row used in the report's per-status sections
 * (passed / partially covered / missing / awaiting review).
 */
export type ReportControlRow = {
  controlCode: string;
  name: string;
  category: string;
  riskLevel: RiskLevel;
  confidence: number;
  detail: string;
};

export type ReportSummary = {
  executiveSummary: string;
  readiness: ReadinessScore;
  criticalFindings: Array<{ controlCode: string; title: string; riskLevel: RiskLevel }>;
  highFindings: Array<{ controlCode: string; title: string; riskLevel: RiskLevel }>;
  recommendations: Array<{
    controlCode: string;
    action: string;
    owner: string;
    timelineLabel: string;
    priority: string;
  }>;
  evidenceInventory: Array<{
    fileName: string;
    category: string;
    sizeLabel: string;
    uploadedAt: string;
    status: EvidenceAnalysisStatus;
    mappedControls: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    total: number;
    passed: number;
    needsAttention: number;
    missing: number;
    needsReview: number;
  }>;
  controlsByStatus: {
    passed: ReportControlRow[];
    needsAttention: ReportControlRow[];
    missing: ReportControlRow[];
    needsReview: ReportControlRow[];
  };
  conductedBy: string;
  analysisMode: string;
  disclaimer: string;
};

export type ReportRecord = {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  frameworkKey: FrameworkKey;
  companyName: string;
  fileName: string;
  generatedAt: string;
  status: ReportStatus;
  scoreIndex: number;
  summary: ReportSummary;
  requestedBy: string;
};

export type AuditEvent = {
  id: string;
  organizationId: string;
  actor: string;
  action: string;
  target: string;
  at: string;
};
