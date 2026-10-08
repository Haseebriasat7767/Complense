/**
 * Storage abstraction. Two implementations ship with ComplyLens:
 *  - memory  : zero-setup in-memory store seeded with the demo workspace
 *  - mongodb : persistent store used automatically when MONGODB_URI is set
 *
 * Analytical results (control status, mappings, findings) are derived
 * deterministically from evidence by the analysis engine, so only the
 * user-mutable records are persisted here.
 */
import type {
  AuditEvent,
  EvidenceInput,
  EvidenceRecord,
  Organization,
  ReportRecord,
  User,
  Workspace,
} from '../domain/types.js';

export type StoreKind = 'memory' | 'mongodb';

export type NewAccount = {
  organization: Organization;
  workspace: Workspace;
  user: User;
};

export interface Store {
  readonly kind: StoreKind;
  init(): Promise<void>;
  health(): Promise<{ ok: boolean; kind: StoreKind; detail: string }>;

  createAccount(input: NewAccount): Promise<void>;

  getOrganization(id: string): Promise<Organization | null>;
  updateOrganization(id: string, patch: Partial<Organization>): Promise<Organization | null>;

  getWorkspace(id: string): Promise<Workspace | null>;
  listWorkspaces(organizationId: string): Promise<Workspace[]>;
  updateWorkspace(id: string, patch: Partial<Workspace>): Promise<Workspace | null>;

  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  updateUser(id: string, patch: Partial<User>): Promise<User | null>;
  touchLastLogin(id: string): Promise<void>;
  countUsers(organizationId: string): Promise<number>;

  listEvidence(organizationId: string, workspaceId: string): Promise<EvidenceRecord[]>;
  getEvidence(id: string, organizationId: string): Promise<EvidenceRecord | null>;
  createEvidence(input: EvidenceInput): Promise<EvidenceRecord>;
  updateEvidence(
    id: string,
    organizationId: string,
    patch: Partial<EvidenceRecord>,
  ): Promise<EvidenceRecord | null>;
  deleteEvidence(id: string, organizationId: string): Promise<boolean>;

  listReports(organizationId: string, workspaceId: string): Promise<ReportRecord[]>;
  getReport(id: string, organizationId: string): Promise<ReportRecord | null>;
  createReport(report: ReportRecord): Promise<ReportRecord>;
  updateReport(
    id: string,
    organizationId: string,
    patch: Partial<ReportRecord>,
  ): Promise<ReportRecord | null>;
  deleteReport(id: string, organizationId: string): Promise<boolean>;

  listAuditEvents(organizationId: string, limit: number): Promise<AuditEvent[]>;
  recordAuditEvent(event: Omit<AuditEvent, 'id'>): Promise<void>;

  close(): Promise<void>;
}
