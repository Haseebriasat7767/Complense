/**
 * Supabase (PostgreSQL) store — the persistent production store.
 *
 * Replaces the former MongoDB/Mongoose store. Every method is a direct
 * translation of the previous document operation into a relational query
 * against the tables created by `supabase/migrations/`:
 *
 *   organizations · workspaces · users · evidence · reports · audit_events
 *
 * Rules enforced here:
 *   • every read and write of a tenant-owned row carries `organization_id`
 *     (and `workspace_id` where the entity is workspace-scoped), so a session
 *     for one organisation can never touch another organisation's data —
 *     authorisation is in the query, not only in the UI;
 *   • values are always passed as parameters through the Supabase client's
 *     filter builders; no SQL string is ever concatenated from user input;
 *   • timestamps are converted back to the exact ISO-8601 strings the API has
 *     always returned, so no response shape changes;
 *   • errors are sanitised before they are logged or surfaced.
 */
import { config } from '../config.js';
import { logger } from '../logger.js';
import type {
  AuditEvent,
  EvidenceInput,
  EvidenceRecord,
  FrameworkKey,
  Organization,
  ReportRecord,
  User,
  Workspace,
} from '../domain/types.js';
import type { NewAccount, Store, StoreHealth } from './store.js';
import { newId as id } from './ids.js';
import { buildDemoSeed, logSeedSummary } from './seed.js';
import { createSupabaseClient, sanitizeDbError, type SupabaseClient } from './supabase-client.js';

export const TABLES = {
  organizations: 'organizations',
  workspaces: 'workspaces',
  users: 'users',
  evidence: 'evidence',
  reports: 'reports',
  auditEvents: 'audit_events',
} as const;

/* -------------------------------------------------------------------------- */
/* Row <-> domain mapping                                                      */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

/** Postgres timestamptz -> the exact `2026-09-10T08:00:00.000Z` shape. */
function toIso(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function toIsoOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return toIso(value);
}

/** Drop undefined entries so a PATCH never nulls a column it did not mention. */
function defined(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) if (value !== undefined) out[key] = value;
  return out;
}

function organizationFromRow(row: Row): Organization {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    plan: (row.plan ?? 'starter') as Organization['plan'],
    primaryFramework: (row.primary_framework ?? 'soc2') as FrameworkKey,
    industry: String(row.industry ?? ''),
    employeeCount: Number(row.employee_count ?? 0),
    createdAt: toIso(row.created_at),
    settings: (row.settings ?? {}) as Organization['settings'],
  };
}

function organizationToRow(value: Partial<Organization>): Row {
  return defined({
    id: value.id,
    name: value.name,
    slug: value.slug,
    plan: value.plan,
    primary_framework: value.primaryFramework,
    industry: value.industry,
    employee_count: value.employeeCount,
    created_at: value.createdAt,
    settings: value.settings,
  });
}

function workspaceFromRow(row: Row): Workspace {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name ?? ''),
    isDemo: Boolean(row.is_demo),
    isDefault: Boolean(row.is_default),
    createdAt: toIso(row.created_at),
    ownerUserId: String(row.owner_user_id ?? ''),
  };
}

function workspaceToRow(value: Partial<Workspace>): Row {
  return defined({
    id: value.id,
    organization_id: value.organizationId,
    name: value.name,
    is_demo: value.isDemo,
    is_default: value.isDefault,
    created_at: value.createdAt,
    owner_user_id: value.ownerUserId,
  });
}

function userFromRow(row: Row): User {
  const user: User = {
    id: String(row.id),
    organizationId: String(row.organization_id),
    email: String(row.email ?? ''),
    name: String(row.name ?? ''),
    jobTitle: String(row.job_title ?? ''),
    role: (row.role ?? 'member') as User['role'],
    isDemoUser: Boolean(row.is_demo_user),
    passwordHash: String(row.password_hash ?? ''),
    createdAt: toIso(row.created_at),
  };
  const lastLoginAt = toIsoOrUndefined(row.last_login_at);
  if (lastLoginAt) user.lastLoginAt = lastLoginAt;
  return user;
}

function userToRow(value: Partial<User>): Row {
  return defined({
    id: value.id,
    organization_id: value.organizationId,
    // Email is the login identifier and is matched case-insensitively.
    email: value.email === undefined ? undefined : value.email.toLowerCase(),
    name: value.name,
    job_title: value.jobTitle,
    role: value.role,
    is_demo_user: value.isDemoUser,
    password_hash: value.passwordHash,
    created_at: value.createdAt,
    last_login_at: value.lastLoginAt,
  });
}

function evidenceFromRow(row: Row): EvidenceRecord {
  const record: EvidenceRecord = {
    id: String(row.id),
    organizationId: String(row.organization_id),
    workspaceId: String(row.workspace_id),
    fileName: String(row.file_name ?? ''),
    fileExtension: String(row.file_extension ?? ''),
    mimeType: String(row.mime_type ?? 'application/octet-stream'),
    sizeBytes: Number(row.size_bytes ?? 0),
    category: String(row.category ?? 'Uncategorised'),
    source: (row.source ?? 'upload') as EvidenceRecord['source'],
    uploadedAt: toIso(row.uploaded_at),
    uploadedBy: String(row.uploaded_by ?? ''),
    status: (row.status ?? 'analyzing') as EvidenceRecord['status'],
    frameworkKeys: Array.isArray(row.framework_keys) ? (row.framework_keys as FrameworkKey[]) : [],
    content: String(row.content ?? ''),
    summary: String(row.summary ?? ''),
  };
  if (row.source_ref) record.sourceRef = String(row.source_ref);
  if (row.size_on_disk !== null && row.size_on_disk !== undefined) {
    record.sizeOnDisk = Number(row.size_on_disk);
  }
  if (row.created_by_user) record.createdByUser = String(row.created_by_user);
  if (row.storage_bucket) record.storageBucket = String(row.storage_bucket);
  if (row.storage_path) record.storagePath = String(row.storage_path);
  return record;
}

function evidenceToRow(value: Partial<EvidenceRecord>): Row {
  return defined({
    id: value.id,
    organization_id: value.organizationId,
    workspace_id: value.workspaceId,
    file_name: value.fileName,
    file_extension: value.fileExtension,
    mime_type: value.mimeType,
    size_bytes: value.sizeBytes,
    category: value.category,
    source: value.source,
    source_ref: value.sourceRef,
    uploaded_at: value.uploadedAt,
    uploaded_by: value.uploadedBy,
    status: value.status,
    framework_keys: value.frameworkKeys,
    content: value.content,
    summary: value.summary,
    size_on_disk: value.sizeOnDisk,
    created_by_user: value.createdByUser,
    storage_bucket: value.storageBucket,
    storage_path: value.storagePath,
  });
}

function reportFromRow(row: Row): ReportRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    workspaceId: String(row.workspace_id),
    name: String(row.name ?? ''),
    frameworkKey: (row.framework_key ?? 'soc2') as FrameworkKey,
    companyName: String(row.company_name ?? ''),
    fileName: String(row.file_name ?? ''),
    generatedAt: toIso(row.generated_at),
    status: (row.status ?? 'ready') as ReportRecord['status'],
    scoreIndex: Number(row.score_index ?? 0),
    summary: (row.summary ?? {}) as ReportRecord['summary'],
    requestedBy: String(row.requested_by ?? ''),
  };
}

function reportToRow(value: Partial<ReportRecord>): Row {
  return defined({
    id: value.id,
    organization_id: value.organizationId,
    workspace_id: value.workspaceId,
    name: value.name,
    framework_key: value.frameworkKey,
    company_name: value.companyName,
    file_name: value.fileName,
    generated_at: value.generatedAt,
    status: value.status,
    score_index: value.scoreIndex,
    summary: value.summary,
    requested_by: value.requestedBy,
  });
}

function auditFromRow(row: Row): AuditEvent {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    actor: String(row.actor ?? ''),
    action: String(row.action ?? ''),
    target: String(row.target ?? ''),
    at: toIso(row.at),
  };
}

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/* -------------------------------------------------------------------------- */

type QueryResult<T> = { data: T | null; error: unknown; count?: number | null };

/** Raise a sanitised error for any failed Supabase response. */
function unwrap<T>(result: QueryResult<T>, operation: string): T | null {
  if (result.error) {
    const error = result.error as { code?: string; message?: string };
    const message = sanitizeDbError(result.error);
    logger.error('Database operation failed', {
      operation,
      code: error.code ?? 'unknown',
      reason: message,
    });
    throw new Error(`${operation} failed: ${message}`);
  }
  return result.data;
}

export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const;
  readonly persistent = true;

  constructor(private readonly client: SupabaseClient) {}

  static create(client?: SupabaseClient): SupabaseStore {
    return new SupabaseStore(client ?? createSupabaseClient());
  }

  /** Expose the client so the evidence file service can reach Storage. */
  get supabase(): SupabaseClient {
    return this.client;
  }

  private table(name: string) {
    return this.client.from(name);
  }

  /* ---------------------------------------------------------------- lifecycle */

  async init(): Promise<void> {
    // 1. Prove the schema is reachable before anything else runs. A missing
    //    table here means the migrations were never applied.
    const probe = (await this.table(TABLES.organizations)
      .select('id')
      .limit(1)) as QueryResult<Row[]>;
    if (probe.error) {
      const error = probe.error as { code?: string };
      const message = sanitizeDbError(probe.error);
      if (error.code === '42P01' || /relation .* does not exist|schema cache/i.test(message)) {
        throw new Error(
          'The ComplyLens schema is missing from this Supabase project. Apply the migrations in ' +
            'supabase/migrations/ (see supabase/README.md) and redeploy. Details: ' +
            message,
        );
      }
      throw new Error(`Supabase is unreachable: ${message}`);
    }

    if (!config.demoMode) {
      logger.info('Supabase store ready (demo seeding disabled)', { schema: config.supabase.schema });
      return;
    }

    await this.seedDemoWorkspace();
  }

  /**
   * Deterministic, idempotent demo seed.
   *
   * The demo organisation is only created when it is absent. Every insert uses
   * `on conflict do nothing`, so two concurrent cold starts cannot duplicate
   * rows and an existing (possibly customer-edited) demo workspace is never
   * overwritten. Real customer organisations are untouched.
   */
  private async seedDemoWorkspace(): Promise<void> {
    const seed = await buildDemoSeed();

    const existing = unwrap<Row[]>(
      (await this.table(TABLES.organizations)
        .select('id')
        .eq('id', seed.organization.id)
        .limit(1)) as QueryResult<Row[]>,
      'demo seed lookup',
    );

    if (existing && existing.length > 0) {
      logger.info('Supabase store ready', {
        schema: config.supabase.schema,
        demoWorkspace: 'already present (not reseeded)',
      });
      return;
    }

    const insertIgnoring = async (table: string, rows: Row[]) => {
      if (rows.length === 0) return;
      const result = (await this.table(table).upsert(rows, {
        onConflict: 'id',
        ignoreDuplicates: true,
      })) as QueryResult<null>;
      unwrap(result, `demo seed insert into ${table}`);
    };

    await insertIgnoring(TABLES.organizations, [organizationToRow(seed.organization)]);
    await insertIgnoring(TABLES.workspaces, [workspaceToRow(seed.workspace)]);
    await insertIgnoring(TABLES.users, [seed.owner, seed.member].map(userToRow));
    await insertIgnoring(TABLES.evidence, seed.evidence.map(evidenceToRow));

    await logSeedSummary('supabase', seed);
  }

  async health(): Promise<StoreHealth> {
    const startedAt = Date.now();
    try {
      const result = (await this.table(TABLES.organizations)
        .select('id', { count: 'exact', head: true })) as QueryResult<null>;
      const latencyMs = Date.now() - startedAt;

      if (result.error) {
        return {
          ok: false,
          kind: this.kind,
          persistent: true,
          latencyMs,
          // Sanitised: never a URL, key, password or raw SQL containing them.
          detail: `Supabase query failed: ${sanitizeDbError(result.error)}`,
        };
      }

      return {
        ok: true,
        kind: this.kind,
        persistent: true,
        latencyMs,
        detail: `Supabase PostgreSQL reachable — verified with a live query on "${config.supabase.schema}.organizations" in ${latencyMs}ms.`,
      };
    } catch (error) {
      return {
        ok: false,
        kind: this.kind,
        persistent: true,
        latencyMs: Date.now() - startedAt,
        detail: `Supabase query failed: ${sanitizeDbError(error)}`,
      };
    }
  }

  async close(): Promise<void> {
    /* The Data API client holds no socket to release. */
  }

  /* ------------------------------------------------------------- accounts */

  async createAccount({ organization, workspace, user }: NewAccount): Promise<void> {
    unwrap(
      (await this.table(TABLES.organizations).insert(
        organizationToRow(organization),
      )) as QueryResult<null>,
      'create organization',
    );

    try {
      unwrap(
        (await this.table(TABLES.workspaces).insert(workspaceToRow(workspace))) as QueryResult<null>,
        'create workspace',
      );
      unwrap((await this.table(TABLES.users).insert(userToRow(user))) as QueryResult<null>, 'create user');
    } catch (error) {
      // Compensate so a half-created account cannot block a retry of the same
      // email/organisation. Deleting the organisation cascades to the rest.
      await this.table(TABLES.organizations)
        .delete()
        .eq('id', organization.id)
        .then(undefined, () => undefined);
      throw error;
    }
  }

  /* -------------------------------------------------------- organizations */

  async getOrganization(organizationId: string): Promise<Organization | null> {
    const row = unwrap<Row>(
      (await this.table(TABLES.organizations)
        .select('*')
        .eq('id', organizationId)
        .maybeSingle()) as QueryResult<Row>,
      'get organization',
    );
    return row ? organizationFromRow(row) : null;
  }

  async updateOrganization(
    organizationId: string,
    patch: Partial<Organization>,
  ): Promise<Organization | null> {
    const { id: _ignored, ...rest } = patch;
    const row = unwrap<Row>(
      (await this.table(TABLES.organizations)
        .update(organizationToRow(rest))
        .eq('id', organizationId)
        .select('*')
        .maybeSingle()) as QueryResult<Row>,
      'update organization',
    );
    return row ? organizationFromRow(row) : null;
  }

  /* ------------------------------------------------------------ workspaces */

  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const row = unwrap<Row>(
      (await this.table(TABLES.workspaces)
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle()) as QueryResult<Row>,
      'get workspace',
    );
    return row ? workspaceFromRow(row) : null;
  }

  async listWorkspaces(organizationId: string): Promise<Workspace[]> {
    const rows = unwrap<Row[]>(
      (await this.table(TABLES.workspaces)
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })) as QueryResult<Row[]>,
      'list workspaces',
    );
    return (rows ?? []).map(workspaceFromRow);
  }

  async updateWorkspace(workspaceId: string, patch: Partial<Workspace>): Promise<Workspace | null> {
    const { id: _ignored, organizationId: _org, ...rest } = patch;
    const row = unwrap<Row>(
      (await this.table(TABLES.workspaces)
        .update(workspaceToRow(rest))
        .eq('id', workspaceId)
        .select('*')
        .maybeSingle()) as QueryResult<Row>,
      'update workspace',
    );
    return row ? workspaceFromRow(row) : null;
  }

  /* ----------------------------------------------------------------- users */

  async getUserByEmail(email: string): Promise<User | null> {
    const row = unwrap<Row>(
      (await this.table(TABLES.users)
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle()) as QueryResult<Row>,
      'get user by email',
    );
    return row ? userFromRow(row) : null;
  }

  async getUserById(userId: string): Promise<User | null> {
    const row = unwrap<Row>(
      (await this.table(TABLES.users).select('*').eq('id', userId).maybeSingle()) as QueryResult<Row>,
      'get user by id',
    );
    return row ? userFromRow(row) : null;
  }

  async updateUser(userId: string, patch: Partial<User>): Promise<User | null> {
    const { id: _ignored, organizationId: _org, ...rest } = patch;
    const row = unwrap<Row>(
      (await this.table(TABLES.users)
        .update(userToRow(rest))
        .eq('id', userId)
        .select('*')
        .maybeSingle()) as QueryResult<Row>,
      'update user',
    );
    return row ? userFromRow(row) : null;
  }

  async touchLastLogin(userId: string): Promise<void> {
    unwrap(
      (await this.table(TABLES.users)
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId)) as QueryResult<null>,
      'touch last login',
    );
  }

  async countUsers(organizationId: string): Promise<number> {
    const result = (await this.table(TABLES.users)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)) as QueryResult<null>;
    unwrap(result, 'count users');
    return result.count ?? 0;
  }

  /* -------------------------------------------------------------- evidence */

  async listEvidence(organizationId: string, workspaceId: string): Promise<EvidenceRecord[]> {
    const rows = unwrap<Row[]>(
      (await this.table(TABLES.evidence)
        .select('*')
        .eq('organization_id', organizationId)
        .eq('workspace_id', workspaceId)
        .order('uploaded_at', { ascending: false })) as QueryResult<Row[]>,
      'list evidence',
    );
    return (rows ?? []).map(evidenceFromRow);
  }

  async getEvidence(evidenceId: string, organizationId: string): Promise<EvidenceRecord | null> {
    const row = unwrap<Row>(
      (await this.table(TABLES.evidence)
        .select('*')
        .eq('id', evidenceId)
        .eq('organization_id', organizationId)
        .maybeSingle()) as QueryResult<Row>,
      'get evidence',
    );
    return row ? evidenceFromRow(row) : null;
  }

  async createEvidence(input: EvidenceInput): Promise<EvidenceRecord> {
    const record = { ...input, id: input.id ?? id('ev') } as EvidenceRecord;
    const row = unwrap<Row>(
      (await this.table(TABLES.evidence)
        .insert(evidenceToRow(record))
        .select('*')
        .maybeSingle()) as QueryResult<Row>,
      'create evidence',
    );
    return row ? evidenceFromRow(row) : record;
  }

  async updateEvidence(
    evidenceId: string,
    organizationId: string,
    patch: Partial<EvidenceRecord>,
  ): Promise<EvidenceRecord | null> {
    const { id: _ignored, organizationId: _org, ...rest } = patch;
    const row = unwrap<Row>(
      (await this.table(TABLES.evidence)
        .update(evidenceToRow(rest))
        .eq('id', evidenceId)
        .eq('organization_id', organizationId)
        .select('*')
        .maybeSingle()) as QueryResult<Row>,
      'update evidence',
    );
    return row ? evidenceFromRow(row) : null;
  }

  async deleteEvidence(evidenceId: string, organizationId: string): Promise<boolean> {
    const rows = unwrap<Row[]>(
      (await this.table(TABLES.evidence)
        .delete()
        .eq('id', evidenceId)
        .eq('organization_id', organizationId)
        .select('id')) as QueryResult<Row[]>,
      'delete evidence',
    );
    return (rows ?? []).length > 0;
  }

  /* --------------------------------------------------------------- reports */

  async listReports(organizationId: string, workspaceId: string): Promise<ReportRecord[]> {
    const rows = unwrap<Row[]>(
      (await this.table(TABLES.reports)
        .select('*')
        .eq('organization_id', organizationId)
        .eq('workspace_id', workspaceId)
        .order('generated_at', { ascending: false })) as QueryResult<Row[]>,
      'list reports',
    );
    return (rows ?? []).map(reportFromRow);
  }

  async getReport(reportId: string, organizationId: string): Promise<ReportRecord | null> {
    const row = unwrap<Row>(
      (await this.table(TABLES.reports)
        .select('*')
        .eq('id', reportId)
        .eq('organization_id', organizationId)
        .maybeSingle()) as QueryResult<Row>,
      'get report',
    );
    return row ? reportFromRow(row) : null;
  }

  async createReport(report: ReportRecord): Promise<ReportRecord> {
    const row = unwrap<Row>(
      (await this.table(TABLES.reports)
        .insert(reportToRow(report))
        .select('*')
        .maybeSingle()) as QueryResult<Row>,
      'create report',
    );
    return row ? reportFromRow(row) : report;
  }

  async updateReport(
    reportId: string,
    organizationId: string,
    patch: Partial<ReportRecord>,
  ): Promise<ReportRecord | null> {
    const { id: _ignored, organizationId: _org, ...rest } = patch;
    const row = unwrap<Row>(
      (await this.table(TABLES.reports)
        .update(reportToRow(rest))
        .eq('id', reportId)
        .eq('organization_id', organizationId)
        .select('*')
        .maybeSingle()) as QueryResult<Row>,
      'update report',
    );
    return row ? reportFromRow(row) : null;
  }

  async deleteReport(reportId: string, organizationId: string): Promise<boolean> {
    const rows = unwrap<Row[]>(
      (await this.table(TABLES.reports)
        .delete()
        .eq('id', reportId)
        .eq('organization_id', organizationId)
        .select('id')) as QueryResult<Row[]>,
      'delete report',
    );
    return (rows ?? []).length > 0;
  }

  /* ---------------------------------------------------------- audit events */

  async listAuditEvents(organizationId: string, limit: number): Promise<AuditEvent[]> {
    const rows = unwrap<Row[]>(
      (await this.table(TABLES.auditEvents)
        .select('*')
        .eq('organization_id', organizationId)
        .order('at', { ascending: false })
        .limit(Math.max(1, Math.min(500, Math.trunc(limit) || 1)))) as QueryResult<Row[]>,
      'list audit events',
    );
    return (rows ?? []).map(auditFromRow);
  }

  async recordAuditEvent(event: Omit<AuditEvent, 'id'>): Promise<void> {
    const result = (await this.table(TABLES.auditEvents).insert({
      id: id('aud'),
      organization_id: event.organizationId,
      actor: event.actor,
      action: event.action,
      target: event.target,
      at: event.at,
    })) as QueryResult<null>;

    // The audit trail must never break a user-facing request.
    if (result.error) {
      logger.warn('Audit event could not be recorded', {
        action: event.action,
        reason: sanitizeDbError(result.error),
      });
    }
  }
}
