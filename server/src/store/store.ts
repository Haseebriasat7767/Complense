/**
 * Storage abstraction. Supabase is the persistent production store; MemoryStore
 * is only for local demo/test use when explicitly configured.
 */
import type { AuditEvent, EvidenceInput, EvidenceRecord, Organization, Questionnaire, QuestionnaireItem, RemediationEvent, RemediationRecord, ReportRecord, ReusableAnswer, User, Workspace } from '../domain/types.js';

export type StoreKind = 'memory' | 'supabase';
export type NewAccount = { organization: Organization; workspace: Workspace; user: User };

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
  updateEvidence(id: string, organizationId: string, patch: Partial<EvidenceRecord>): Promise<EvidenceRecord | null>;
  deleteEvidence(id: string, organizationId: string): Promise<boolean>;
  listReports(organizationId: string, workspaceId: string): Promise<ReportRecord[]>;
  getReport(id: string, organizationId: string): Promise<ReportRecord | null>;
  createReport(report: ReportRecord): Promise<ReportRecord>;
  updateReport(id: string, organizationId: string, patch: Partial<ReportRecord>): Promise<ReportRecord | null>;
  deleteReport(id: string, organizationId: string): Promise<boolean>;
  listRemediations(organizationId: string, workspaceId: string): Promise<RemediationRecord[]>;
  getRemediation(id: string, organizationId: string, workspaceId: string): Promise<RemediationRecord | null>;
  createRemediation(record: RemediationRecord): Promise<RemediationRecord>;
  updateRemediation(id: string, organizationId: string, workspaceId: string, patch: Partial<RemediationRecord>): Promise<RemediationRecord | null>;
  listRemediationEvents(organizationId: string, workspaceId: string, remediationId: string): Promise<RemediationEvent[]>;
  recordRemediationEvent(event: RemediationEvent): Promise<void>;
  listAuditEvents(organizationId: string, limit: number): Promise<AuditEvent[]>;
  recordAuditEvent(event: Omit<AuditEvent, 'id'>): Promise<void>;
  // --- Reusable questionnaire library ---------------------------------
  listReusableAnswers(organizationId: string): Promise<ReusableAnswer[]>;
  getReusableAnswer(id: string, organizationId: string): Promise<ReusableAnswer | null>;
  getReusableAnswerBySlug(organizationId: string, questionSlug: string): Promise<ReusableAnswer | null>;
  createReusableAnswer(answer: ReusableAnswer): Promise<ReusableAnswer>;
  updateReusableAnswer(id: string, organizationId: string, patch: Partial<ReusableAnswer>): Promise<ReusableAnswer | null>;
  deleteReusableAnswer(id: string, organizationId: string): Promise<boolean>;
  countReusableAnswers(organizationId: string): Promise<number>;
  listQuestionnaires(organizationId: string): Promise<Questionnaire[]>;
  getQuestionnaire(id: string, organizationId: string): Promise<Questionnaire | null>;
  createQuestionnaire(questionnaire: Questionnaire): Promise<Questionnaire>;
  updateQuestionnaire(id: string, organizationId: string, patch: Partial<Questionnaire>): Promise<Questionnaire | null>;
  deleteQuestionnaire(id: string, organizationId: string): Promise<boolean>;
  countQuestionnaires(organizationId: string): Promise<number>;
  listQuestionnaireItems(questionnaireId: string, organizationId: string): Promise<QuestionnaireItem[]>;
  getQuestionnaireItem(id: string, organizationId: string): Promise<QuestionnaireItem | null>;
  createQuestionnaireItem(item: QuestionnaireItem): Promise<QuestionnaireItem>;
  updateQuestionnaireItem(id: string, organizationId: string, patch: Partial<QuestionnaireItem>): Promise<QuestionnaireItem | null>;
  deleteQuestionnaireItem(id: string, organizationId: string): Promise<boolean>;
  close(): Promise<void>;
}
