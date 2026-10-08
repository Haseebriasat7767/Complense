/**
 * Client-side mirror of the API DTOs in `server/src/http/dto.ts`.
 * Keep the two files in sync when the API shape changes.
 */

export type FrameworkKey = 'soc2' | 'iso27001';
export type ControlStatus = 'passed' | 'needs_attention' | 'missing' | 'needs_review';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type EvidenceStatus = 'analyzed' | 'analyzing' | 'needs_review' | 'failed';
export type ReportStatus = 'generating' | 'ready' | 'failed';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export type User = {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: 'owner' | 'admin' | 'member';
  isDemoUser: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
};

export type OrganizationSettings = {
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

export type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'growth' | 'business';
  primaryFramework: FrameworkKey;
  industry: string;
  employeeCount: number;
  createdAt: string;
  settings: OrganizationSettings;
};

export type Workspace = {
  id: string;
  name: string;
  isDemo: boolean;
  isDefault: boolean;
  createdAt: string;
  ownerUserId: string;
};

export type SessionPayload = {
  token: string;
  expiresAt: string;
  user: User;
  organization: Organization;
  workspace: Workspace | null;
  workspaces: Workspace[];
  persistence: 'memory' | 'mongodb';
};

export type WorkspaceContext = {
  user: Pick<User, 'id' | 'name' | 'email' | 'jobTitle' | 'role' | 'isDemoUser'> | null;
  organization: Organization;
  workspace: Workspace;
  workspaces: Workspace[];
  demoMode: boolean;
  analysisMode: { key: 'demo-analysis' | 'external-ai'; label: string };
};

export type MappedControlRef = {
  controlId: string;
  controlCode: string;
  controlName: string;
  confidence: number;
};

export type EvidenceItem = {
  id: string;
  fileName: string;
  fileExtension: string;
  mimeType: string;
  sizeBytes: number;
  sizeLabel: string;
  category: string;
  source: 'demo' | 'upload';
  uploadedAt: string;
  uploadedBy: string;
  status: EvidenceStatus;
  frameworkKeys: FrameworkKey[];
  summary: string;
  mappedControlCount: number;
  mappedControls: MappedControlRef[];
  textExcerpt: string;
};

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

export type EvidenceDetail = EvidenceItem & {
  extractedText: string;
  mapping: MappingEntry[];
  isDemoSample: boolean;
};

export type ControlListItem = {
  id: string;
  code: string;
  frameworkKey: FrameworkKey;
  framework: string;
  category: string;
  name: string;
  riskLevel: RiskLevel;
  risk: RiskLevel;
  status: ControlStatus;
  statusLabel: string;
  confidence: number;
  requiredEvidence: string[];
  matchedEvidence: string[];
  missingEvidence: string[];
  evidenceCount: number;
  analysisNote: string;
  updatedAt: string;
  findingId: string | null;
  findingTitle: string | null;
  priority: Priority | null;
};

export type ControlDetail = {
  control: {
    id: string;
    code: string;
    name: string;
    frameworkKey: FrameworkKey;
    framework: string;
    frameworkVersion: string;
    category: string;
    description: string;
    rationale: string;
    riskLevel: RiskLevel;
    status: ControlStatus;
    statusLabel: string;
    confidence: number;
    analysisNote: string;
    updatedAt: string;
    isPolicyDomain: boolean;
  };
  requirements: Array<{ label: string; satisfied: boolean }>;
  evidenceFound: EvidenceItem[];
  evidenceMissing: string[];
  analysis: { mode: string; note: string; mappedDocuments: number; confidence: number };
  finding: Finding | null;
  recommendation: { fix: string; owner: string; timelineDays: number };
  relatedControls: Array<{
    id: string;
    code: string;
    name: string;
    status: ControlStatus;
    statusLabel: string;
  }>;
  disclaimer: string;
};

export type Finding = {
  id: string;
  controlId: string;
  controlCode: string;
  controlName: string;
  frameworkKey: FrameworkKey;
  framework?: string;
  category: string;
  riskLevel: RiskLevel;
  priority: Priority;
  status: 'open' | 'planned' | 'resolved';
  title: string;
  finding: string;
  evidenceFound: Array<{ evidenceId: string; fileName: string }>;
  evidenceLinks?: Array<{ evidenceId: string; fileName: string; status: EvidenceStatus; category: string }>;
  evidenceMissing: string[];
  recommendation: {
    fix: string;
    owner: string;
    timelineDays: number;
    timelineLabel: string;
    priorityNote: string;
  };
  aiGenerated: boolean;
  guidanceLabel?: string;
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

export type ReadinessCounts = {
  total: number;
  reviewed: number;
  passed: number;
  needsAttention: number;
  missing: number;
  needsReview: number;
};

export type DashboardData = {
  workspace: Workspace;
  organization: Organization;
  greeting: { period: string; label: string; name: string };
  generatedAt: string;
  analysisMode: { key: 'demo-analysis' | 'external-ai'; label: string };
  framework: { key: FrameworkKey; name: string; shortName: string };
  metric: {
    readinessIndex: number;
    bandLabel: string;
    components: ReadinessComponent[];
    methodology: string;
  };
  counts: ReadinessCounts;
  findings: { critical: number; high: number; medium: number; low: number; total: number };
  frameworks: Array<{
    key: FrameworkKey;
    name: string;
    shortName: string;
    readinessIndex: number;
    bandLabel: string;
    counts: ReadinessCounts;
    readinessLabel: string;
  }>;
  priorityFindings: Finding[];
  recentEvidence: EvidenceItem[];
  coverage: {
    total: number;
    analyzed: number;
    needsReview: number;
    failed: number;
    analyzing: number;
    distinctControlsCovered: number;
    unmappedDocuments: string[];
    documentsWithFindings: number;
  };
  categories: Array<{
    category: string;
    total: number;
    passed: number;
    needsAttention: number;
    missing: number;
    needsReview: number;
  }>;
  topControl: ControlListItem;
  activity: {
    workspaceName: string;
    openFindings: number;
    items: Array<{ id: string; at: string; label: string; detail: string; type: string }>;
  };
};

export type FrameworkReadiness = {
  key: FrameworkKey;
  name: string;
  shortName: string;
  version: string;
  description: string;
  intent: string;
  readinessLabel: string;
  status: string;
  readinessIndex: number;
  bandLabel: string;
  counts: ReadinessCounts;
  components: ReadinessComponent[];
  methodology: string;
  controls: number;
  categories: Array<{
    category: string;
    controls: number;
    passed: number;
    needsAttention: number;
    missing: number;
    needsReview: number;
  }>;
  coverage: {
    documents: number;
    documentsMapped: number;
    distinctControlsCovered: number;
    unmappedDocuments: string[];
  };
  findings: number;
};

export type MappingsResponse = {
  documents: Array<{
    id: string;
    fileName: string;
    category: string;
    status: EvidenceStatus;
    summary: string;
    uploadedAt: string;
    mappedControls: number;
    controls: Array<{
      controlId: string;
      controlCode: string;
      controlName: string;
      frameworkKey: FrameworkKey;
      confidence: number;
      matchedItems: string[];
      missingItems: string[];
    }>;
  }>;
  controls: Array<{
    controlId: string;
    controlCode: string;
    controlName: string;
    frameworkKey: FrameworkKey;
    category: string;
    status: ControlStatus;
    statusLabel: string;
    riskLevel: RiskLevel;
    confidence: number;
    evidenceCount: number;
    missingItems: string[];
  }>;
  findings: Array<{
    id: string;
    controlId: string;
    controlCode: string;
    title: string;
    riskLevel: RiskLevel;
    priority: Priority;
  }>;
  summary: {
    documents: number;
    mappedDocuments: number;
    controlsCovered: number;
    findings: number;
    unmappedDocuments: string[];
  };
  disclaimer: string;
};

export type ReportListItem = {
  id: string;
  name: string;
  frameworkKey: FrameworkKey;
  framework: string;
  companyName: string;
  fileName: string;
  generatedAt: string;
  status: ReportStatus;
  scoreIndex: number;
  requestedBy: string;
  downloadUrl: string;
};

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
  readiness: {
    index: number;
    band: string;
    bandLabel: string;
    components: ReadinessComponent[];
    counts: ReadinessCounts;
    openFindings: number;
    methodology: string;
  };
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
    status: EvidenceStatus;
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

export type ReportDetail = ReportListItem & { summary: ReportSummary };

export type MetaResponse = {
  product: { name: string; tagline: string; version: string; stage: string };
  frameworks: Array<{
    key: FrameworkKey;
    name: string;
    shortName: string;
    version: string;
    description: string;
    intent: string;
    readinessLabel: string;
    controlCount: number;
    categoryCount: number;
    categories: string[];
  }>;
  analysis: {
    mode: 'demo-analysis' | 'external-ai';
    label: string;
    scoring: { weights: Record<string, number>; methodology: string };
  };
  uploads: { maxBytes: number; allowedExtensions: string[] };
  demoMode: boolean;
  authRequired: boolean;
  disclaimers: { short: string; full: string; report: string; demoData: string };
};

export type ApiErrorShape = { error: { code: string; message: string; details?: unknown } };
