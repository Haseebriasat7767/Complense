/**
 * Supabase-backed Store implementation using the server-side Data API.
 * SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) must never reach
 * the browser. Authorization and organization scoping are enforced in routes
 * and again in each relevant store query.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type {
  AuditEvent, EvidenceInput, EvidenceRecord, Organization, ReportRecord, User, Workspace,
} from '../domain/types.js';
import type { NewAccount, Store } from './store.js';
import { buildDemoSeed, logSeedSummary } from './seed.js';

type Row = Record<string, any>;
function makeId(prefix: string): string { return `${prefix}-${crypto.randomBytes(8).toString('hex')}`; }
function cleanPatch<T extends { id?: string }>(value: Partial<T>): Record<string, unknown> {
  const { id: _id, ...rest } = value;
  return rest as Record<string, unknown>;
}

export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const;
  private readonly baseUrl: string;
  private readonly key: string;

  private constructor(url: string, key: string) {
    this.baseUrl = url.replace(/\/$/, '') + '/rest/v1';
    this.key = key;
  }

  static connect(): SupabaseStore {
    const url = config.database.supabaseUrl;
    const key = config.database.supabaseSecretKey;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
      throw new Error('SUPABASE_URL must be the HTTPS URL of your Supabase project.');
    }
    return new SupabaseStore(url, key);
  }

  private async request<T = Row[]>(table: string, options: {
    method?: string; query?: Record<string, string>; body?: unknown; prefer?: string; count?: boolean;
  } = {}): Promise<{ data: T; count: number | null }> {
    const url = new URL(`${this.baseUrl}/${table}`);
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
    const headers: Record<string, string> = {
      apikey: this.key,
      // Authorization is added below for legacy JWT keys only.
      Accept: 'application/json',
    };
    if (!this.key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${this.key}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.prefer) headers.Prefer = options.prefer;
    if (options.count) headers.Prefer = [headers.Prefer, 'count=exact'].filter(Boolean).join(',');
    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new Error('Could not reach Supabase. Check project URL and network settings.');
    }
    const raw = await response.text();
    if (!response.ok) {
      let code = '';
      try {
        const parsed = JSON.parse(raw) as { code?: string; message?: string };
        code = [parsed.code, parsed.message].filter(Boolean).join(': ');
      } catch { /* don't echo unparseable server response */ }
      logger.warn('Supabase request failed', { table, status: response.status, code: code.slice(0, 180) });
      if (response.status === 401 || response.status === 403) throw new Error('Supabase rejected the server key or database permissions.');
      if (response.status === 404) throw new Error('Supabase table or Data API endpoint not found. Apply the database migration and check Data API settings.');
      throw new Error(`Supabase database request failed (HTTP ${response.status}). Check migration and database logs.`);
    }
    const countHeader = response.headers.get('content-range');
    const match = countHeader?.match(/\/(\d+)$/);
    const count = match ? Number(match[1]) : null;
    if (!raw) return { data: [] as T, count };
    try { return { data: JSON.parse(raw) as T, count }; }
    catch { throw new Error('Supabase returned an unexpected response.'); }
  }

  private async rows<T>(table: string, query: Record<string, string> = {}): Promise<T[]> {
    const result = await this.request<T[]>(table, { query: { select: '*', ...query } });
    return result.data;
  }
  private async one<T>(table: string, query: Record<string, string>): Promise<T | null> {
    const result = await this.rows<T>(table, { ...query, limit: '1' });
    return result[0] ?? null;
  }
  private async insert<T>(table: string, value: unknown): Promise<T> {
    const result = await this.request<T[]>(table, { method: 'POST', query: { select: '*' }, body: value, prefer: 'return=representation' });
    if (!result.data[0]) throw new Error(`Supabase insert into ${table} returned no record.`);
    return result.data[0];
  }
  private async patchOne<T>(table: string, query: Record<string, string>, patch: unknown): Promise<T | null> {
    const result = await this.request<T[]>(table, { method: 'PATCH', query: { ...query, select: '*' }, body: patch, prefer: 'return=representation' });
    return result.data[0] ?? null;
  }
  private async deleteOne(table: string, query: Record<string, string>): Promise<boolean> {
    const result = await this.request<Row[]>(table, { method: 'DELETE', query: { ...query, select: 'id' }, prefer: 'return=representation' });
    return result.data.length > 0;
  }

  async init(): Promise<void> {
    await this.request('organizations', { query: { select: 'id', limit: '1' } });
    const seed = await buildDemoSeed();
    const existing = await this.one<Organization>('organizations', { id: `eq.${seed.organization.id}` });
    if (!existing) {
      await this.insert('organizations', seed.organization);
      await this.insert('workspaces', seed.workspace);
      await this.insert('users', seed.owner);
      await this.insert('users', seed.member);
      for (const record of seed.evidence) await this.insert('evidence', record);
      await logSeedSummary('supabase', seed);
    } else {
      logger.info('Supabase store ready');
    }
  }

  async health() {
    try {
      await this.request('organizations', { query: { select: 'id', limit: '1' } });
      return { ok: true, kind: this.kind, detail: 'Connected to Supabase PostgreSQL; database query succeeded.' };
    } catch {
      return { ok: false, kind: this.kind, detail: 'Supabase is configured but a database health query failed.' };
    }
  }

  async createAccount(input: NewAccount): Promise<void> {
    await this.insert('organizations', input.organization);
    try {
      await this.insert('workspaces', input.workspace);
      await this.insert('users', input.user);
    } catch (error) {
      // Avoid leaving a half-created account when a later insert fails.
      await this.deleteOne('organizations', { id: `eq.${input.organization.id}` }).catch(() => false);
      throw error;
    }
  }
  getOrganization(id: string) { return this.one<Organization>('organizations', { id: `eq.${id}` }); }
  updateOrganization(id: string, patch: Partial<Organization>) { return this.patchOne<Organization>('organizations', { id: `eq.${id}` }, cleanPatch(patch)); }
  getWorkspace(id: string) { return this.one<Workspace>('workspaces', { id: `eq.${id}` }); }
  listWorkspaces(organizationId: string) { return this.rows<Workspace>('workspaces', { 'organizationId': `eq.${organizationId}`, order: 'createdAt.asc' }); }
  updateWorkspace(id: string, patch: Partial<Workspace>) { return this.patchOne<Workspace>('workspaces', { id: `eq.${id}` }, cleanPatch(patch)); }
  getUserByEmail(email: string) { return this.one<User>('users', { email: `eq.${email.toLowerCase()}` }); }
  getUserById(id: string) { return this.one<User>('users', { id: `eq.${id}` }); }
  updateUser(id: string, patch: Partial<User>) { return this.patchOne<User>('users', { id: `eq.${id}` }, cleanPatch(patch)); }
  async touchLastLogin(id: string) { await this.request('users', { method: 'PATCH', query: { id: `eq.${id}` }, body: { lastLoginAt: new Date().toISOString() }, prefer: 'return=minimal' }); }
  async countUsers(organizationId: string) {
    const result = await this.request<Row[]>('users', { query: { select: 'id', 'organizationId': `eq.${organizationId}`, limit: '0' }, count: true });
    return result.count ?? 0;
  }
  listEvidence(organizationId: string, workspaceId: string) { return this.rows<EvidenceRecord>('evidence', { organizationId: `eq.${organizationId}`, workspaceId: `eq.${workspaceId}`, order: 'uploadedAt.desc' }); }
  getEvidence(id: string, organizationId: string) { return this.one<EvidenceRecord>('evidence', { id: `eq.${id}`, organizationId: `eq.${organizationId}` }); }
  async createEvidence(input: EvidenceInput) {
    return this.insert<EvidenceRecord>('evidence', { ...input, id: input.id ?? makeId('ev') });
  }
  updateEvidence(id: string, organizationId: string, patch: Partial<EvidenceRecord>) { return this.patchOne<EvidenceRecord>('evidence', { id: `eq.${id}`, organizationId: `eq.${organizationId}` }, cleanPatch(patch)); }
  deleteEvidence(id: string, organizationId: string) { return this.deleteOne('evidence', { id: `eq.${id}`, organizationId: `eq.${organizationId}` }); }
  listReports(organizationId: string, workspaceId: string) { return this.rows<ReportRecord>('reports', { organizationId: `eq.${organizationId}`, workspaceId: `eq.${workspaceId}`, order: 'generatedAt.desc' }); }
  getReport(id: string, organizationId: string) { return this.one<ReportRecord>('reports', { id: `eq.${id}`, organizationId: `eq.${organizationId}` }); }
  createReport(report: ReportRecord) { return this.insert<ReportRecord>('reports', report); }
  updateReport(id: string, organizationId: string, patch: Partial<ReportRecord>) { return this.patchOne<ReportRecord>('reports', { id: `eq.${id}`, organizationId: `eq.${organizationId}` }, cleanPatch(patch)); }
  deleteReport(id: string, organizationId: string) { return this.deleteOne('reports', { id: `eq.${id}`, organizationId: `eq.${organizationId}` }); }
  listAuditEvents(organizationId: string, limit: number) { return this.rows<AuditEvent>('audit_events', { organizationId: `eq.${organizationId}`, order: 'at.desc', limit: String(Math.max(0, Math.min(limit, 500))) }); }
  async recordAuditEvent(event: Omit<AuditEvent, 'id'>) { await this.insert('audit_events', { ...event, id: makeId('aud') }); }
  async close(): Promise<void> { /* fetch-based client holds no pooled socket */ }
}
