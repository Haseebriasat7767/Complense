/**
 * In-memory store — the zero-setup default.
 *
 * Everything lives in process memory and is discarded on restart. It is the
 * right store for the demo, for evaluating the product, and for running the
 * test suite. Set SUPABASE_URL and SUPABASE_SECRET_KEY to use the persistent store.
 */
import crypto from 'node:crypto';
import type {
  AuditEvent,
  EvidenceInput,
  EvidenceRecord,
  Organization,
  Questionnaire,
  QuestionnaireItem,
  ReportRecord,
  RemediationEvent,
  RemediationRecord,
  ReusableAnswer,
  User,
  Workspace,
} from '../domain/types.js';
import type { NewAccount, Store } from './store.js';
import { buildDemoSeed, logSeedSummary } from './seed.js';

function id(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}

export class MemoryStore implements Store {
  readonly kind = 'memory' as const;

  constructor(private readonly diagnostic?: string) {}

  private organizations = new Map<string, Organization>();
  private workspaces = new Map<string, Workspace>();
  private users = new Map<string, User>();
  private usersByEmail = new Map<string, string>();
  private evidence = new Map<string, EvidenceRecord>();
  private reports = new Map<string, ReportRecord>();
  private remediations = new Map<string, RemediationRecord>();
  private remediationEvents: RemediationEvent[] = [];
  private audit: AuditEvent[] = [];
  private reusableAnswers = new Map<string, ReusableAnswer>();
  private questionnaires = new Map<string, Questionnaire>();
  private questionnaireItems = new Map<string, QuestionnaireItem>();

  async init(): Promise<void> {
    const seed = await buildDemoSeed();
    this.organizations.set(seed.organization.id, seed.organization);
    this.workspaces.set(seed.workspace.id, seed.workspace);
    for (const user of [seed.owner, seed.member]) {
      this.users.set(user.id, user);
      this.usersByEmail.set(user.email.toLowerCase(), user.id);
    }
    for (const record of seed.evidence) this.evidence.set(record.id, record);
    await logSeedSummary('memory', seed);
  }

  async health() {
    return {
      ok: true,
      kind: this.kind,
      detail: this.diagnostic
        ? `Supabase configured but unavailable: ${this.diagnostic}. In-memory demo data resets on restart.`
        : `In-memory demo store — ${this.evidence.size} evidence records, ${this.users.size} users. Data resets on restart.`,
    };
  }

  async createAccount(input: NewAccount): Promise<void> {
    this.organizations.set(input.organization.id, input.organization);
    this.workspaces.set(input.workspace.id, input.workspace);
    this.users.set(input.user.id, input.user);
    this.usersByEmail.set(input.user.email.toLowerCase(), input.user.id);
  }

  async getOrganization(organizationId: string) {
    return this.organizations.get(organizationId) ?? null;
  }

  async updateOrganization(organizationId: string, patch: Partial<Organization>) {
    const current = this.organizations.get(organizationId);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id };
    this.organizations.set(organizationId, next);
    return next;
  }

  async getWorkspace(workspaceId: string) {
    return this.workspaces.get(workspaceId) ?? null;
  }

  async listWorkspaces(organizationId: string) {
    return [...this.workspaces.values()]
      .filter((workspace) => workspace.organizationId === organizationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async updateWorkspace(workspaceId: string, patch: Partial<Workspace>) {
    const current = this.workspaces.get(workspaceId);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id, organizationId: current.organizationId };
    this.workspaces.set(workspaceId, next);
    return next;
  }

  async getUserByEmail(email: string) {
    const userId = this.usersByEmail.get(email.toLowerCase());
    return userId ? (this.users.get(userId) ?? null) : null;
  }

  async getUserById(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async updateUser(userId: string, patch: Partial<User>) {
    const current = this.users.get(userId);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id };
    this.users.set(userId, next);
    this.usersByEmail.set(next.email.toLowerCase(), next.id);
    return next;
  }

  async touchLastLogin(userId: string) {
    const user = this.users.get(userId);
    if (!user) return;
    this.users.set(userId, { ...user, lastLoginAt: new Date().toISOString() });
  }

  async countUsers(organizationId: string) {
    return [...this.users.values()].filter((user) => user.organizationId === organizationId).length;
  }

  async listEvidence(organizationId: string, workspaceId: string) {
    return [...this.evidence.values()]
      .filter((doc) => doc.organizationId === organizationId && doc.workspaceId === workspaceId)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  async getEvidence(evidenceId: string, organizationId: string) {
    const doc = this.evidence.get(evidenceId);
    if (!doc || doc.organizationId !== organizationId) return null;
    return doc;
  }

  async createEvidence(input: EvidenceInput) {
    const record: EvidenceRecord = { ...input, id: input.id ?? id('ev') };
    this.evidence.set(record.id, record);
    return record;
  }

  async updateEvidence(evidenceId: string, organizationId: string, patch: Partial<EvidenceRecord>) {
    const current = await this.getEvidence(evidenceId, organizationId);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id, organizationId: current.organizationId };
    this.evidence.set(evidenceId, next);
    return next;
  }

  async deleteEvidence(evidenceId: string, organizationId: string) {
    const current = await this.getEvidence(evidenceId, organizationId);
    if (!current) return false;
    this.evidence.delete(evidenceId);
    return true;
  }

  async listReports(organizationId: string, workspaceId: string) {
    return [...this.reports.values()]
      .filter((report) => report.organizationId === organizationId && report.workspaceId === workspaceId)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  async getReport(reportId: string, organizationId: string) {
    const report = this.reports.get(reportId);
    if (!report || report.organizationId !== organizationId) return null;
    return report;
  }

  async createReport(report: ReportRecord) {
    this.reports.set(report.id, report);
    return report;
  }

  async updateReport(reportId: string, organizationId: string, patch: Partial<ReportRecord>) {
    const current = await this.getReport(reportId, organizationId);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id, organizationId: current.organizationId };
    this.reports.set(reportId, next);
    return next;
  }

  async deleteReport(reportId: string, organizationId: string) {
    const current = await this.getReport(reportId, organizationId);
    if (!current) return false;
    this.reports.delete(reportId);
    return true;
  }

  async listRemediations(organizationId: string, workspaceId: string) {
    return [...this.remediations.values()]
      .filter((record) => record.organizationId === organizationId && record.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getRemediation(recordId: string, organizationId: string, workspaceId: string) {
    const record = this.remediations.get(recordId);
    if (!record || record.organizationId !== organizationId || record.workspaceId !== workspaceId) return null;
    return record;
  }

  async createRemediation(record: RemediationRecord) {
    this.remediations.set(record.id, record);
    return record;
  }

  async updateRemediation(recordId: string, organizationId: string, workspaceId: string, patch: Partial<RemediationRecord>) {
    const current = await this.getRemediation(recordId, organizationId, workspaceId);
    if (!current) return null;
    const next = {
      ...current,
      ...patch,
      id: current.id,
      organizationId: current.organizationId,
      workspaceId: current.workspaceId,
      createdBy: current.createdBy,
      createdAt: current.createdAt,
    };
    this.remediations.set(recordId, next);
    return next;
  }

  async listRemediationEvents(organizationId: string, workspaceId: string, remediationId: string) {
    return this.remediationEvents
      .filter((event) => event.organizationId === organizationId && event.workspaceId === workspaceId && event.remediationId === remediationId)
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  async recordRemediationEvent(event: RemediationEvent) {
    this.remediationEvents.push(event);
    if (this.remediationEvents.length > 2000) this.remediationEvents = this.remediationEvents.slice(-2000);
  }

  async listAuditEvents(organizationId: string, limit: number) {
    return this.audit
      .filter((event) => event.organizationId === organizationId)
      .slice(-limit)
      .reverse();
  }

  async recordAuditEvent(event: Omit<AuditEvent, 'id'>) {
    this.audit.push({ ...event, id: id('aud') });
    if (this.audit.length > 500) this.audit = this.audit.slice(-500);
  }

  // --- Reusable questionnaire library ---------------------------------
  async listReusableAnswers(organizationId: string) {
    return [...this.reusableAnswers.values()]
      .filter((answer) => answer.organizationId === organizationId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getReusableAnswer(answerId: string, organizationId: string) {
    const answer = this.reusableAnswers.get(answerId);
    if (!answer || answer.organizationId !== organizationId) return null;
    return answer;
  }

  async getReusableAnswerBySlug(organizationId: string, questionSlug: string) {
    return (
      [...this.reusableAnswers.values()].find(
        (answer) => answer.organizationId === organizationId && answer.questionSlug === questionSlug,
      ) ?? null
    );
  }

  async createReusableAnswer(answer: ReusableAnswer) {
    this.reusableAnswers.set(answer.id, answer);
    return answer;
  }

  async updateReusableAnswer(answerId: string, organizationId: string, patch: Partial<ReusableAnswer>) {
    const current = await this.getReusableAnswer(answerId, organizationId);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id, organizationId: current.organizationId };
    this.reusableAnswers.set(answerId, next);
    return next;
  }

  async deleteReusableAnswer(answerId: string, organizationId: string) {
    const current = await this.getReusableAnswer(answerId, organizationId);
    if (!current) return false;
    this.reusableAnswers.delete(answerId);
    return true;
  }

  async countReusableAnswers(organizationId: string) {
    return [...this.reusableAnswers.values()].filter((answer) => answer.organizationId === organizationId).length;
  }

  async listQuestionnaires(organizationId: string) {
    return [...this.questionnaires.values()]
      .filter((item) => item.organizationId === organizationId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getQuestionnaire(questionnaireId: string, organizationId: string) {
    const item = this.questionnaires.get(questionnaireId);
    if (!item || item.organizationId !== organizationId) return null;
    return item;
  }

  async createQuestionnaire(questionnaire: Questionnaire) {
    this.questionnaires.set(questionnaire.id, questionnaire);
    return questionnaire;
  }

  async updateQuestionnaire(questionnaireId: string, organizationId: string, patch: Partial<Questionnaire>) {
    const current = await this.getQuestionnaire(questionnaireId, organizationId);
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id, organizationId: current.organizationId };
    this.questionnaires.set(questionnaireId, next);
    return next;
  }

  async deleteQuestionnaire(questionnaireId: string, organizationId: string) {
    const current = await this.getQuestionnaire(questionnaireId, organizationId);
    if (!current) return false;
    this.questionnaires.delete(questionnaireId);
    for (const item of [...this.questionnaireItems.values()]) {
      if (item.questionnaireId === questionnaireId) this.questionnaireItems.delete(item.id);
    }
    return true;
  }

  async countQuestionnaires(organizationId: string) {
    return [...this.questionnaires.values()].filter((item) => item.organizationId === organizationId).length;
  }

  async listQuestionnaireItems(questionnaireId: string, organizationId: string) {
    return [...this.questionnaireItems.values()]
      .filter((item) => item.questionnaireId === questionnaireId && item.organizationId === organizationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getQuestionnaireItem(itemId: string, organizationId: string) {
    const item = this.questionnaireItems.get(itemId);
    if (!item || item.organizationId !== organizationId) return null;
    return item;
  }

  async createQuestionnaireItem(item: QuestionnaireItem) {
    this.questionnaireItems.set(item.id, item);
    return item;
  }

  async updateQuestionnaireItem(itemId: string, organizationId: string, patch: Partial<QuestionnaireItem>) {
    const current = await this.getQuestionnaireItem(itemId, organizationId);
    if (!current) return null;
    const next = {
      ...current,
      ...patch,
      id: current.id,
      organizationId: current.organizationId,
      questionnaireId: current.questionnaireId,
    };
    this.questionnaireItems.set(itemId, next);
    return next;
  }

  async deleteQuestionnaireItem(itemId: string, organizationId: string) {
    const current = await this.getQuestionnaireItem(itemId, organizationId);
    if (!current) return false;
    this.questionnaireItems.delete(itemId);
    return true;
  }

  async close() {
    /* nothing to release */
  }
}
