/**
 * In-process fake of the Supabase client surface used by `SupabaseStore` and
 * `services/evidence-files.ts`.
 *
 * Why a fake and not a live project: the repository must build and test
 * without credentials, and tests must never touch real customer data. The fake
 * implements the exact PostgREST/Storage semantics the store relies on —
 * filter chaining, ordering, `maybeSingle()`, `head`+`count`, upsert with
 * `ignoreDuplicates`, delete-returning, primary-key and unique-index
 * violations (SQLSTATE 23505), foreign keys (23503) and ON DELETE CASCADE —
 * so the store's real query code is exercised end to end.
 *
 * It is deliberately NOT a general-purpose Postgres emulator: anything the
 * store does not use throws, so silent divergence is impossible.
 */

export type FakeRow = Record<string, unknown>;

type Filter = { column: string; value: unknown };

export type FakeTableSpec = {
  /** Columns forming the primary key (always `id` here). */
  primaryKey: string;
  /** Extra unique indexes, e.g. case-insensitive email. */
  unique?: Array<{ name: string; key: (row: FakeRow) => string | null }>;
  /** Foreign keys with ON DELETE CASCADE semantics. */
  references?: Array<{ column: string; table: string; onDelete: 'cascade' }>;
};

const SCHEMA: Record<string, FakeTableSpec> = {
  organizations: { primaryKey: 'id' },
  workspaces: {
    primaryKey: 'id',
    references: [{ column: 'organization_id', table: 'organizations', onDelete: 'cascade' }],
  },
  users: {
    primaryKey: 'id',
    unique: [
      {
        name: 'users_email_lower_key',
        key: (row) => (row.email === undefined || row.email === null ? null : String(row.email).toLowerCase()),
      },
    ],
    references: [{ column: 'organization_id', table: 'organizations', onDelete: 'cascade' }],
  },
  evidence: {
    primaryKey: 'id',
    unique: [
      {
        name: 'evidence_storage_path_key',
        key: (row) => (row.storage_path ? String(row.storage_path) : null),
      },
    ],
    references: [
      { column: 'organization_id', table: 'organizations', onDelete: 'cascade' },
      { column: 'workspace_id', table: 'workspaces', onDelete: 'cascade' },
    ],
  },
  reports: {
    primaryKey: 'id',
    references: [
      { column: 'organization_id', table: 'organizations', onDelete: 'cascade' },
      { column: 'workspace_id', table: 'workspaces', onDelete: 'cascade' },
    ],
  },
  // No FK on organization_id — mirrors the real schema (see the migration).
  audit_events: { primaryKey: 'id' },
};

export class PostgrestLikeError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

type Result<T> = { data: T; error: PostgrestLikeError | null; count: number | null };

function ok<T>(data: T, count: number | null = null): Result<T> {
  return { data, error: null, count };
}

function fail(error: PostgrestLikeError): Result<null> {
  return { data: null, error, count: null };
}

function matches(row: FakeRow, filters: Filter[]): boolean {
  return filters.every((filter) => row[filter.column] === filter.value);
}

function compare(a: unknown, b: unknown): number {
  const left = a === null || a === undefined ? '' : String(a);
  const right = b === null || b === undefined ? '' : String(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

export class FakeDatabase {
  /** Set to a message to make the next operation fail (connectivity tests). */
  failWith: { message: string; code: string } | null = null;
  /** Tables that should behave as if they do not exist (missing migrations). */
  missingTables = new Set<string>();
  readonly queryLog: string[] = [];

  readonly tables: Record<string, FakeRow[]> = {
    organizations: [],
    workspaces: [],
    users: [],
    evidence: [],
    reports: [],
    audit_events: [],
  };

  rows(table: string): FakeRow[] {
    const rows = this.tables[table];
    if (!rows) throw new Error(`fake-supabase: unknown table "${table}"`);
    return rows;
  }

  reset(): void {
    for (const key of Object.keys(this.tables)) this.tables[key] = [];
    this.failWith = null;
    this.missingTables.clear();
    this.queryLog.length = 0;
  }

  /** Snapshot used by "survives a fresh client" tests. */
  clone(): FakeDatabase {
    const copy = new FakeDatabase();
    for (const [table, rows] of Object.entries(this.tables)) {
      copy.tables[table] = rows.map((row) => ({ ...row }));
    }
    return copy;
  }

  checkConstraints(table: string, candidate: FakeRow, ignoreIndex = -1): PostgrestLikeError | null {
    const spec = SCHEMA[table];
    if (!spec) return null;
    const rows = this.rows(table);

    const pk = candidate[spec.primaryKey];
    const pkClash = rows.findIndex((row) => row[spec.primaryKey] === pk);
    if (pkClash >= 0 && pkClash !== ignoreIndex) {
      return new PostgrestLikeError(
        `duplicate key value violates unique constraint "${table}_pkey"`,
        '23505',
      );
    }

    for (const index of spec.unique ?? []) {
      const key = index.key(candidate);
      if (key === null) continue;
      const clash = rows.findIndex((row) => index.key(row) === key);
      if (clash >= 0 && clash !== ignoreIndex) {
        return new PostgrestLikeError(
          `duplicate key value violates unique constraint "${index.name}"`,
          '23505',
        );
      }
    }

    for (const reference of spec.references ?? []) {
      const value = candidate[reference.column];
      if (value === undefined || value === null) continue;
      const parent = this.rows(reference.table).some((row) => row.id === value);
      if (!parent) {
        return new PostgrestLikeError(
          `insert or update on table "${table}" violates foreign key constraint on ${reference.column}`,
          '23503',
        );
      }
    }

    return null;
  }

  cascadeDelete(table: string, ids: unknown[]): void {
    for (const [child, spec] of Object.entries(SCHEMA)) {
      for (const reference of spec.references ?? []) {
        if (reference.table !== table || reference.onDelete !== 'cascade') continue;
        const survivors = this.rows(child).filter((row) => !ids.includes(row[reference.column]));
        const removed = this.rows(child).filter((row) => ids.includes(row[reference.column]));
        this.tables[child] = survivors;
        if (removed.length > 0) this.cascadeDelete(child, removed.map((row) => row.id));
      }
    }
  }
}

type Operation =
  | { type: 'select'; head: boolean; wantCount: boolean }
  | { type: 'insert'; rows: FakeRow[] }
  | { type: 'upsert'; rows: FakeRow[]; ignoreDuplicates: boolean }
  | { type: 'update'; patch: FakeRow }
  | { type: 'delete' };

class FakeQuery implements PromiseLike<Result<unknown>> {
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitTo: number | null = null;
  private single: 'maybe' | null = null;
  private returning = false;

  constructor(
    private readonly db: FakeDatabase,
    private readonly table: string,
    private readonly operation: Operation,
  ) {}

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number): this {
    this.limitTo = count;
    return this;
  }

  select(_columns?: string): this {
    this.returning = true;
    return this;
  }

  maybeSingle(): this {
    this.single = 'maybe';
    this.returning = true;
    return this;
  }

  private run(): Result<unknown> {
    const { db, table } = this;

    if (db.failWith) {
      return fail(new PostgrestLikeError(db.failWith.message, db.failWith.code));
    }
    if (db.missingTables.has(table)) {
      return fail(
        new PostgrestLikeError(
          `relation "public.${table}" does not exist`,
          '42P01',
        ),
      );
    }

    db.queryLog.push(
      `${this.operation.type} ${table} ${this.filters.map((f) => `${f.column}=${String(f.value)}`).join('&')}`,
    );

    const rows = db.rows(table);

    switch (this.operation.type) {
      case 'select': {
        let selected = rows.filter((row) => matches(row, this.filters));
        if (this.orderBy) {
          const { column, ascending } = this.orderBy;
          selected = [...selected].sort(
            (a, b) => compare(a[column], b[column]) * (ascending ? 1 : -1),
          );
        }
        const total = selected.length;
        if (this.limitTo !== null) selected = selected.slice(0, this.limitTo);
        if (this.operation.head) return ok(null, this.operation.wantCount ? total : null);
        if (this.single) {
          if (selected.length > 1) {
            return fail(new PostgrestLikeError('multiple rows returned', 'PGRST116'));
          }
          return ok(selected[0] ? { ...selected[0] } : null, total);
        }
        return ok(selected.map((row) => ({ ...row })), total);
      }

      case 'insert': {
        const inserted: FakeRow[] = [];
        for (const candidate of this.operation.rows) {
          const violation = db.checkConstraints(table, candidate);
          if (violation) return fail(violation);
          const copy = { ...candidate };
          rows.push(copy);
          inserted.push({ ...copy });
        }
        return this.shape(inserted);
      }

      case 'upsert': {
        const affected: FakeRow[] = [];
        for (const candidate of this.operation.rows) {
          const existingIndex = rows.findIndex((row) => row.id === candidate.id);
          if (existingIndex >= 0) {
            if (this.operation.ignoreDuplicates) continue;
            const merged = { ...rows[existingIndex], ...candidate };
            const violation = db.checkConstraints(table, merged, existingIndex);
            if (violation) return fail(violation);
            rows[existingIndex] = merged;
            affected.push({ ...merged });
            continue;
          }
          const violation = db.checkConstraints(table, candidate);
          if (violation) {
            // A unique index other than the PK still conflicts, exactly like
            // `on conflict (id) do nothing` in PostgreSQL.
            if (this.operation.ignoreDuplicates && violation.code === '23505') continue;
            return fail(violation);
          }
          const copy = { ...candidate };
          rows.push(copy);
          affected.push({ ...copy });
        }
        return this.shape(affected);
      }

      case 'update': {
        const updated: FakeRow[] = [];
        rows.forEach((row, index) => {
          if (!matches(row, this.filters)) return;
          const merged = { ...row, ...this.operation.type === 'update' ? this.operation.patch : {} };
          const violation = db.checkConstraints(table, merged, index);
          if (violation) throw violation;
          rows[index] = merged;
          updated.push({ ...merged });
        });
        return this.shape(updated);
      }

      case 'delete': {
        const removed = rows.filter((row) => matches(row, this.filters));
        db.tables[table] = rows.filter((row) => !matches(row, this.filters));
        db.cascadeDelete(table, removed.map((row) => row.id));
        return this.shape(removed);
      }

      default:
        return fail(new PostgrestLikeError('unsupported operation', 'FAKE'));
    }
  }

  private shape(affected: FakeRow[]): Result<unknown> {
    if (!this.returning) return ok(null, affected.length);
    if (this.single) return ok(affected[0] ?? null, affected.length);
    return ok(affected, affected.length);
  }

  then<TResult1 = Result<unknown>, TResult2 = never>(
    onfulfilled?: ((value: Result<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    let result: Result<unknown>;
    try {
      result = this.run();
    } catch (error) {
      return Promise.resolve().then(() => {
        if (onrejected) return onrejected(error);
        throw error;
      });
    }
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                     */
/* -------------------------------------------------------------------------- */

export class FakeStorage {
  readonly objects = new Map<string, { bucket: string; path: string; bytes: Buffer; contentType: string }>();
  /** Force the next upload to fail (cleanup/compensation tests). */
  failUploads = false;

  private key(bucket: string, path: string): string {
    return `${bucket}:${path}`;
  }

  from(bucket: string) {
    return {
      upload: async (
        path: string,
        bytes: Buffer,
        options?: { contentType?: string; upsert?: boolean },
      ) => {
        if (this.failUploads) {
          return { data: null, error: new PostgrestLikeError('storage is unavailable', 'StorageError') };
        }
        const key = this.key(bucket, path);
        if (this.objects.has(key) && options?.upsert !== true) {
          return { data: null, error: new PostgrestLikeError('The resource already exists', '409') };
        }
        this.objects.set(key, {
          bucket,
          path,
          bytes: Buffer.from(bytes),
          contentType: options?.contentType ?? 'application/octet-stream',
        });
        return { data: { path }, error: null };
      },
      download: async (path: string) => {
        const object = this.objects.get(this.key(bucket, path));
        if (!object) {
          return { data: null, error: new PostgrestLikeError('Object not found', '404') };
        }
        return {
          data: {
            arrayBuffer: async () =>
              object.bytes.buffer.slice(
                object.bytes.byteOffset,
                object.bytes.byteOffset + object.bytes.byteLength,
              ),
          },
          error: null,
        };
      },
      remove: async (paths: string[]) => {
        for (const path of paths) this.objects.delete(this.key(bucket, path));
        return { data: paths.map((path) => ({ name: path })), error: null };
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Client                                                                      */
/* -------------------------------------------------------------------------- */

export type FakeSupabase = {
  db: FakeDatabase;
  storage: FakeStorage;
  client: unknown;
};

export function createFakeSupabase(db = new FakeDatabase(), storage = new FakeStorage()): FakeSupabase {
  const client = {
    from(table: string) {
      return {
        select: (_columns?: string, options?: { count?: string; head?: boolean }) =>
          new FakeQuery(db, table, {
            type: 'select',
            head: options?.head === true,
            wantCount: options?.count === 'exact',
          }),
        insert: (rows: FakeRow | FakeRow[]) =>
          new FakeQuery(db, table, { type: 'insert', rows: Array.isArray(rows) ? rows : [rows] }),
        upsert: (rows: FakeRow | FakeRow[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) =>
          new FakeQuery(db, table, {
            type: 'upsert',
            rows: Array.isArray(rows) ? rows : [rows],
            ignoreDuplicates: options?.ignoreDuplicates === true,
          }),
        update: (patch: FakeRow) => new FakeQuery(db, table, { type: 'update', patch }),
        delete: () => new FakeQuery(db, table, { type: 'delete' }),
      };
    },
    storage,
  };

  return { db, storage, client };
}
