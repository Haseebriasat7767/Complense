/**
 * MongoDB store (optional).
 *
 * Enabled automatically when MONGODB_URI is set and mongoose can be loaded.
 * If the driver is missing or the connection fails, the application logs a
 * warning and continues on the in-memory store — the demo never breaks because
 * a database is unavailable.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type {
  AuditEvent,
  EvidenceInput,
  EvidenceRecord,
  Organization,
  ReportRecord,
  User,
  Workspace,
} from '../domain/types.js';
import type { NewAccount, Store } from './store.js';
import { buildDemoSeed, logSeedSummary } from './seed.js';

function id(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type MongooseModels = {
  Organization: any;
  Workspace: any;
  User: any;
  Evidence: any;
  Report: any;
  AuditEvent: any;
};

async function loadModels(): Promise<{ connection: any; models: MongooseModels }> {
  const mongoose = (await import('mongoose')) as any;

  const OrganizationSchema = new mongoose.Schema(
    {
      _id: String,
      name: String,
      slug: String,
      plan: String,
      primaryFramework: String,
      industry: String,
      employeeCount: Number,
      createdAt: String,
      settings: Object,
    },
    { versionKey: false },
  );

  const WorkspaceSchema = new mongoose.Schema(
    {
      _id: String,
      organizationId: { type: String, index: true },
      name: String,
      isDemo: Boolean,
      isDefault: Boolean,
      createdAt: String,
      ownerUserId: String,
    },
    { versionKey: false },
  );

  const UserSchema = new mongoose.Schema(
    {
      _id: String,
      organizationId: { type: String, index: true },
      email: { type: String, index: true },
      name: String,
      jobTitle: String,
      role: String,
      isDemoUser: Boolean,
      passwordHash: String,
      createdAt: String,
      lastLoginAt: String,
    },
    { versionKey: false },
  );

  const EvidenceSchema = new mongoose.Schema(
    {
      _id: String,
      organizationId: { type: String, index: true },
      workspaceId: { type: String, index: true },
      fileName: String,
      fileExtension: String,
      mimeType: String,
      sizeBytes: Number,
      category: String,
      source: String,
      sourceRef: String,
      uploadedAt: String,
      uploadedBy: String,
      status: String,
      frameworkKeys: [String],
      content: String,
      summary: String,
    },
    { versionKey: false },
  );

  const ReportSchema = new mongoose.Schema(
    {
      _id: String,
      organizationId: { type: String, index: true },
      workspaceId: { type: String, index: true },
      name: String,
      frameworkKey: String,
      companyName: String,
      fileName: String,
      generatedAt: String,
      status: String,
      scoreIndex: Number,
      summary: Object,
      requestedBy: String,
    },
    { versionKey: false },
  );

  const AuditSchema = new mongoose.Schema(
    {
      _id: String,
      organizationId: { type: String, index: true },
      actor: String,
      action: String,
      target: String,
      at: String,
    },
    { versionKey: false },
  );

  const connection = await mongoose.createConnection(config.database.uri, {
    dbName: config.database.dbName,
    serverSelectionTimeoutMS: 8000,
  }).asPromise();

  const models: MongooseModels = {
    Organization: connection.model('Organization', OrganizationSchema),
    Workspace: connection.model('Workspace', WorkspaceSchema),
    User: connection.model('User', UserSchema),
    Evidence: connection.model('Evidence', EvidenceSchema),
    Report: connection.model('Report', ReportSchema),
    AuditEvent: connection.model('AuditEvent', AuditSchema),
  };

  return { connection, models };
}

function toDomain<T>(doc: any): T | null {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { _id, ...rest } = plain;
  return { id: _id, ...rest } as T;
}

export class MongoStore implements Store {
  readonly kind = 'mongodb' as const;

  private constructor(
    private readonly connection: any,
    private readonly models: MongooseModels,
  ) {}

  static async connect(): Promise<MongoStore | null> {
    try {
      const { connection, models } = await loadModels();
      return new MongoStore(connection, models);
    } catch (error) {
      logger.warn('MongoDB unavailable — continuing on the in-memory demo store', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  async init(): Promise<void> {
    const { organization, workspace, owner, member, evidence } = await buildDemoSeed();

    const existing = await this.models.Organization.findById(organization.id).lean();
    if (!existing) {
      await this.models.Organization.create({ _id: organization.id, ...stripId(organization) });
      await this.models.Workspace.create({ _id: workspace.id, ...stripId(workspace) });
      for (const user of [owner, member]) {
        await this.models.User.create({ _id: user.id, ...stripId(user) });
      }
      for (const record of evidence) {
        await this.models.Evidence.create({ _id: record.id, ...stripId(record) });
      }
      await logSeedSummary('mongodb', { organization, workspace, owner, member, evidence });
    } else {
      logger.info('MongoDB store ready', { database: config.database.dbName });
    }
  }

  async health() {
    try {
      const state = this.connection.readyState;
      const ok = state === 1;
      return {
        ok,
        kind: this.kind,
        detail: ok ? `Connected to database "${config.database.dbName}".` : 'MongoDB connection is not ready.',
      };
    } catch (error) {
      return { ok: false, kind: this.kind, detail: String(error) };
    }
  }

  async createAccount({ organization, workspace, user }: NewAccount): Promise<void> {
    await this.models.Organization.create({ _id: organization.id, ...stripId(organization) });
    await this.models.Workspace.create({ _id: workspace.id, ...stripId(workspace) });
    await this.models.User.create({ _id: user.id, ...stripId(user) });
  }

  async getOrganization(organizationId: string) {
    return toDomain<Organization>(await this.models.Organization.findById(organizationId).lean());
  }

  async updateOrganization(organizationId: string, patch: Partial<Organization>) {
    const updated = await this.models.Organization.findByIdAndUpdate(
      organizationId,
      { $set: stripId(patch) },
      { new: true },
    ).lean();
    return toDomain<Organization>(updated);
  }

  async getWorkspace(workspaceId: string) {
    return toDomain<Workspace>(await this.models.Workspace.findById(workspaceId).lean());
  }

  async listWorkspaces(organizationId: string) {
    const docs = await this.models.Workspace.find({ organizationId }).sort({ createdAt: 1 }).lean();
    return docs.map((doc: any) => toDomain<Workspace>(doc) as Workspace);
  }

  async updateWorkspace(workspaceId: string, patch: Partial<Workspace>) {
    const updated = await this.models.Workspace.findByIdAndUpdate(
      workspaceId,
      { $set: stripId(patch) },
      { new: true },
    ).lean();
    return toDomain<Workspace>(updated);
  }

  async getUserByEmail(email: string) {
    return toDomain<User>(await this.models.User.findOne({ email: email.toLowerCase() }).lean());
  }

  async getUserById(userId: string) {
    return toDomain<User>(await this.models.User.findById(userId).lean());
  }

  async updateUser(userId: string, patch: Partial<User>) {
    const updated = await this.models.User.findByIdAndUpdate(
      userId,
      { $set: stripId(patch) },
      { new: true },
    ).lean();
    return toDomain<User>(updated);
  }

  async touchLastLogin(userId: string) {
    await this.models.User.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date().toISOString() } });
  }

  async countUsers(organizationId: string) {
    return this.models.User.countDocuments({ organizationId });
  }

  async listEvidence(organizationId: string, workspaceId: string) {
    const docs = await this.models.Evidence.find({ organizationId, workspaceId })
      .sort({ uploadedAt: -1 })
      .lean();
    return docs.map((doc: any) => toDomain<EvidenceRecord>(doc) as EvidenceRecord);
  }

  async getEvidence(evidenceId: string, organizationId: string) {
    return toDomain<EvidenceRecord>(
      await this.models.Evidence.findOne({ _id: evidenceId, organizationId }).lean(),
    );
  }

  async createEvidence(input: EvidenceInput) {
    const record = { ...input, id: input.id ?? id('ev') };
    await this.models.Evidence.create({ _id: record.id, ...stripId(record) });
    return record as EvidenceRecord;
  }

  async updateEvidence(evidenceId: string, organizationId: string, patch: Partial<EvidenceRecord>) {
    const updated = await this.models.Evidence.findOneAndUpdate(
      { _id: evidenceId, organizationId },
      { $set: stripId(patch) },
      { new: true },
    ).lean();
    return toDomain<EvidenceRecord>(updated);
  }

  async deleteEvidence(evidenceId: string, organizationId: string) {
    const result = await this.models.Evidence.deleteOne({ _id: evidenceId, organizationId });
    return result.deletedCount === 1;
  }

  async listReports(organizationId: string, workspaceId: string) {
    const docs = await this.models.Report.find({ organizationId, workspaceId })
      .sort({ generatedAt: -1 })
      .lean();
    return docs.map((doc: any) => toDomain<ReportRecord>(doc) as ReportRecord);
  }

  async getReport(reportId: string, organizationId: string) {
    return toDomain<ReportRecord>(
      await this.models.Report.findOne({ _id: reportId, organizationId }).lean(),
    );
  }

  async createReport(report: ReportRecord) {
    await this.models.Report.create({ _id: report.id, ...stripId(report) });
    return report;
  }

  async updateReport(reportId: string, organizationId: string, patch: Partial<ReportRecord>) {
    const updated = await this.models.Report.findOneAndUpdate(
      { _id: reportId, organizationId },
      { $set: stripId(patch) },
      { new: true },
    ).lean();
    return toDomain<ReportRecord>(updated);
  }

  async deleteReport(reportId: string, organizationId: string) {
    const result = await this.models.Report.deleteOne({ _id: reportId, organizationId });
    return result.deletedCount === 1;
  }

  async listAuditEvents(organizationId: string, limit: number) {
    const docs = await this.models.AuditEvent.find({ organizationId })
      .sort({ at: -1 })
      .limit(limit)
      .lean();
    return docs.map((doc: any) => toDomain<AuditEvent>(doc) as AuditEvent);
  }

  async recordAuditEvent(event: Omit<AuditEvent, 'id'>) {
    await this.models.AuditEvent.create({ _id: id('aud'), ...event });
  }

  async close() {
    try {
      await this.connection.close();
    } catch {
      /* ignore */
    }
  }
}

function stripId<T extends { id?: string }>(value: T): Omit<T, 'id'> {
  const { id: _ignored, ...rest } = value;
  return rest;
}
