/**
 * Migration correctness.
 *
 * The SQL in `supabase/migrations/` is the source of truth for the production
 * schema and for the security boundary, so it is asserted here the same way
 * application code is. These checks are static (they parse the SQL) because
 * the repository has no credentials and must never connect to a real project
 * during a test run; applying them to a live database is the documented manual
 * step in supabase/README.md.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../supabase/migrations');

const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
const sqlByFile = new Map(files.map((name) => [name, readFileSync(path.join(migrationsDir, name), 'utf8')]));
const allSql = [...sqlByFile.values()].join('\n').toLowerCase();

const TENANT_TABLES = ['organizations', 'workspaces', 'users', 'evidence', 'reports', 'audit_events'] as const;

describe('migration files', () => {
  it('exist and are ordered by a sortable version prefix', () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const name of files) expect(name).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect([...files]).toEqual([...files].sort());
  });

  it('contain no credentials, keys or connection strings', () => {
    for (const [name, sql] of sqlByFile) {
      expect(sql, name).not.toMatch(/sb_secret_/i);
      expect(sql, name).not.toMatch(/sb_publishable_/i);
      expect(sql, name).not.toMatch(/postgres(ql)?:\/\//i);
      expect(sql, name).not.toMatch(/\beyJ[A-Za-z0-9._-]{20,}/);
      expect(sql, name).not.toMatch(/service_role_key\s*=/i);
    }
  });
});

describe('core schema', () => {
  it('creates every table the application persists', () => {
    for (const table of TENANT_TABLES) {
      expect(allSql, table).toContain(`create table if not exists public.${table}`);
    }
  });

  it('uses TEXT primary keys, matching the ids the application already issues', () => {
    // `org_acmecloud`, `usr-demo-owner`, `ev-demo-<key>` are not UUIDs.
    for (const table of TENANT_TABLES) {
      const block = tableBlock(table);
      expect(block, table).toMatch(/id\s+text primary key/);
      expect(block, table).not.toMatch(/id\s+uuid/);
    }
  });

  it('scopes every tenant table to an organisation', () => {
    for (const table of TENANT_TABLES.filter((name) => name !== 'organizations')) {
      expect(tableBlock(table), table).toMatch(/organization_id\s+text\s+not null/);
    }
  });

  it('declares foreign keys with cascade delete for owned rows', () => {
    for (const table of ['workspaces', 'users', 'evidence', 'reports']) {
      expect(tableBlock(table), table).toMatch(
        /references public\.organizations \(id\) on delete cascade/,
      );
    }
    for (const table of ['evidence', 'reports']) {
      expect(tableBlock(table), table).toMatch(
        /references public\.workspaces \(id\) on delete cascade/,
      );
    }
  });

  it('keeps audit_events free of a FK so password-reset probes cannot enumerate accounts', () => {
    expect(tableBlock('audit_events')).not.toContain('references public.organizations');
  });

  it('enforces one unique, case-insensitive login email', () => {
    expect(allSql).toContain('create unique index if not exists users_email_lower_key');
    expect(allSql).toContain('on public.users (lower(email))');
  });

  it('enforces at most one default workspace per organisation', () => {
    expect(allSql).toContain('create unique index if not exists workspaces_one_default_per_org');
  });

  it('indexes the hot organisation/workspace lookups', () => {
    expect(allSql).toContain('evidence_workspace_idx');
    expect(allSql).toContain('reports_workspace_idx');
    expect(allSql).toContain('audit_events_organization_idx');
    expect(allSql).toContain('users_organization_idx');
  });

  it('constrains enum-like columns instead of trusting the application', () => {
    expect(tableBlock('users')).toMatch(/check \(role in \('owner', 'admin', 'member'\)\)/);
    expect(tableBlock('evidence')).toMatch(/check \(source in \('demo', 'upload'\)\)/);
    expect(tableBlock('evidence')).toMatch(/'analyzed', 'analyzing', 'needs_review', 'failed'/);
    expect(tableBlock('reports')).toMatch(/'generating', 'ready', 'failed'/);
    expect(tableBlock('organizations')).toMatch(/'starter', 'growth', 'business'/);
  });

  it('keeps created/updated timestamps on every table', () => {
    for (const table of TENANT_TABLES) {
      expect(tableBlock(table), table).toContain('created_at        timestamptz'.replace(/\s+/g, ' ').trim().split(' ')[0]);
      expect(tableBlock(table), table).toMatch(/created_at\s+timestamptz not null default now\(\)/);
    }
    for (const table of TENANT_TABLES.filter((name) => name !== 'audit_events')) {
      expect(tableBlock(table), table).toMatch(/updated_at\s+timestamptz not null default now\(\)/);
      expect(allSql, table).toContain(`${table}_set_updated_at`);
    }
  });

  it('stores evidence bytes by reference, never inline in a row', () => {
    const block = tableBlock('evidence');
    expect(block).toContain('storage_bucket');
    expect(block).toContain('storage_path');
    expect(block).not.toContain('bytea');
    expect(block).not.toContain('file_bytes');
  });

  it('keeps the password column a hash column', () => {
    expect(tableBlock('users')).toContain('password_hash');
    expect(tableBlock('users')).not.toMatch(/\bpassword\s+text/);
  });
});

describe('row level security', () => {
  it('enables RLS on every table exposed through the Data API', () => {
    for (const table of TENANT_TABLES) {
      expect(allSql, table).toMatch(
        new RegExp(`alter table public\\.${table}\\s+enable row level security`),
      );
    }
  });

  it('revokes all Data API privileges from the browser roles', () => {
    expect(allSql).toContain("array['anon', 'authenticated']");
    expect(allSql).toContain('revoke all on public.%i from %i');
  });

  it('adds a restrictive organisation-isolation policy', () => {
    expect(allSql).toContain('as restrictive');
    expect(allSql).toContain("current_setting(''request.complylens_org'', true)");
  });

  it('never grants a permissive policy to anon or authenticated', () => {
    expect(allSql).not.toMatch(/create policy[^;]*to\s+(anon|authenticated)[^;]*using\s*\(\s*true\s*\)/);
    expect(allSql).not.toMatch(/grant\s+(all|select|insert|update|delete)[^;]*to\s+(anon|authenticated)/);
  });
});

describe('evidence storage bucket', () => {
  const storageSql = sqlByFile.get('20261009000200_evidence_storage_bucket.sql') ?? '';

  it('creates the bucket as PRIVATE and keeps it private on re-run', () => {
    expect(storageSql).toContain("insert into storage.buckets");
    expect(storageSql).toMatch(/'evidence',\s*\n?\s*false,/);
    expect(storageSql).toContain('set public             = false');
    expect(storageSql).not.toMatch(/public\s*=\s*true/);
  });

  it('caps the object size and restricts mime types', () => {
    expect(storageSql).toContain('file_size_limit');
    expect(storageSql).toContain('allowed_mime_types');
    expect(storageSql).toContain('application/pdf');
  });

  it('blocks browser roles from the evidence bucket', () => {
    expect(storageSql).toContain('as restrictive');
    expect(storageSql).toContain("bucket_id <> 'evidence'");
  });

  it('degrades gracefully on a database without the Supabase storage schema', () => {
    expect(storageSql).toContain("to_regclass('storage.buckets') is null");
  });
});

/** Extract one `create table …(…);` body so assertions cannot match a neighbour. */
function tableBlock(table: string): string {
  const needle = `create table if not exists public.${table} (`;
  const start = allSql.indexOf(needle);
  expect(start, `missing table ${table}`).toBeGreaterThan(-1);
  const end = allSql.indexOf('\n);', start);
  return allSql.slice(start, end === -1 ? undefined : end);
}
