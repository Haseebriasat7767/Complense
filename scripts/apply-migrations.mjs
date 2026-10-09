#!/usr/bin/env node
/**
 * Apply the SQL migrations in `supabase/migrations/` to a PostgreSQL database.
 *
 *   DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
 *     npm run db:migrate
 *
 * Use the Supabase **direct** connection string (port 5432) or the **session**
 * pooler (port 5432 on `aws-0-<region>.pooler.supabase.com`) — DDL must not run
 * through the transaction pooler (port 6543), which does not support prepared
 * statements or multi-statement DDL transactions reliably.
 *
 * Alternatives, both documented in supabase/README.md:
 *   • `supabase db push` with the Supabase CLI (recommended),
 *   • pasting each file into the Supabase SQL editor in filename order.
 *
 * Properties:
 *   • idempotent — applied files are recorded in `public.schema_migrations`;
 *   • each file runs inside a transaction and rolls back on error;
 *   • never prints the connection string, the password or any credential.
 *
 * `pg` is a devDependency (migrations are an operator task, not a runtime one).
 * Install it with `npm install` at the repo root before running this script.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');

const connectionString = process.env.DATABASE_URL ?? '';
if (!connectionString) {
  console.error(
    [
      'DATABASE_URL is not set.',
      '',
      'Set it to the Supabase connection string (Project Settings → Database →',
      'Connection string → URI, port 5432) and re-run:',
      '',
      '  DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" npm run db:migrate',
      '',
      'Never commit this value or paste it into a chat.',
    ].join('\n'),
  );
  process.exit(1);
}

let pg;
try {
  pg = await import('pg');
} catch {
  console.error('The "pg" package is not installed. Run `npm install` in the repository root first.');
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error(`No .sql files found in ${migrationsDir}`);
  process.exit(1);
}

/** Redact anything that could carry a credential before it reaches a log. */
function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, 'postgresql://***')
    .replace(/(password[=:\s]+)[^\s,;"']+/gi, '$1***');
}

const client = new pg.default.Client({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false },
  statement_timeout: 120_000,
  connectionTimeoutMillis: 20_000,
});

try {
  await client.connect();
} catch (error) {
  console.error(`Could not connect to the database: ${safeMessage(error)}`);
  process.exit(1);
}

let applied = 0;
let skipped = 0;

try {
  await client.query(`
    create table if not exists public.schema_migrations (
      version     text primary key,
      checksum    text not null,
      applied_at  timestamptz not null default now()
    );
  `);

  const { rows } = await client.query('select version, checksum from public.schema_migrations');
  const known = new Map(rows.map((row) => [row.version, row.checksum]));

  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = known.get(file);

    if (previous) {
      if (previous !== checksum) {
        console.error(
          `✗ ${file} was already applied but its contents changed.\n` +
            '  Existing migrations must never be edited — add a new migration file instead.',
        );
        process.exitCode = 1;
      } else {
        skipped += 1;
        console.log(`  · ${file} (already applied)`);
      }
      continue;
    }

    await client.query('begin');
    try {
      await client.query(sql);
      await client.query(
        'insert into public.schema_migrations (version, checksum) values ($1, $2)',
        [file, checksum],
      );
      await client.query('commit');
      applied += 1;
      console.log(`  ✓ ${file}`);
    } catch (error) {
      await client.query('rollback');
      console.error(`  ✗ ${file} — ${safeMessage(error)}`);
      throw error;
    }
  }

  console.log(`\n${applied} migration(s) applied, ${skipped} already present.`);
} catch {
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
