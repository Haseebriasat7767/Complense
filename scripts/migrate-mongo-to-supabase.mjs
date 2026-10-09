#!/usr/bin/env node
/**
 * OPTIONAL one-time data migration: MongoDB → Supabase PostgreSQL.
 *
 * ComplyLens no longer runs on MongoDB. Existing Mongo records do NOT appear in
 * Supabase automatically — this script is the supported way to copy them once.
 * It is not part of the runtime and nothing imports it.
 *
 * Requirements (nothing is invented or guessed — the script refuses to run
 * without explicit configuration):
 *
 *   MONGODB_URI           source connection string
 *   MONGODB_DB            source database name (default: complylens)
 *   SUPABASE_URL          target project URL
 *   SUPABASE_SECRET_KEY   target secret (service role) key — server-side only
 *
 * The `mongodb` driver is NOT a dependency of this project. Install it only for
 * the duration of the migration:
 *
 *   npm install --no-save mongodb
 *   MONGODB_URI="..." MONGODB_DB="complylens" \
 *   SUPABASE_URL="https://<ref>.supabase.co" SUPABASE_SECRET_KEY="sb_secret_..." \
 *     npm run db:migrate:mongo -- --apply
 *
 * Safety:
 *   • dry run by default — pass `--apply` to write;
 *   • inserts use `on conflict do nothing`, so re-running never overwrites a
 *     row that already exists in Supabase;
 *   • apply supabase/migrations/ FIRST (npm run db:migrate);
 *   • no credential is ever printed.
 */
import process from 'node:process';

const apply = process.argv.includes('--apply');

const mongoUri = process.env.MONGODB_URI ?? '';
const mongoDbName = process.env.MONGODB_DB || 'complylens';
const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const missing = [];
if (!mongoUri) missing.push('MONGODB_URI');
if (!supabaseUrl) missing.push('SUPABASE_URL');
if (!supabaseKey) missing.push('SUPABASE_SECRET_KEY');
if (missing.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      'This script never guesses a connection. See the header of this file for usage.',
  );
  process.exit(1);
}

function redact(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, 'mongodb://***')
    .replace(/https?:\/\/[A-Za-z0-9-]+\.supabase\.(co|in|net)[^\s"']*/gi, '<supabase-url>')
    .replace(/\b(sb_secret|sb_publishable)_[A-Za-z0-9._-]+/g, '<redacted-key>')
    .replace(/(password[=:\s]+)[^\s,;"']+/gi, '$1***');
}

let MongoClient;
try {
  ({ MongoClient } = await import('mongodb'));
} catch {
  console.error(
    'The "mongodb" driver is not installed (it is intentionally not a project dependency).\n' +
      'Run `npm install --no-save mongodb` and try again.',
  );
  process.exit(1);
}

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** collection → { table, map }. Mirrors the old Mongoose schemas exactly. */
const PLAN = [
  {
    collection: 'organizations',
    table: 'organizations',
    map: (doc) => ({
      id: doc._id,
      name: doc.name ?? '',
      slug: doc.slug ?? '',
      plan: doc.plan ?? 'starter',
      primary_framework: doc.primaryFramework ?? 'soc2',
      industry: doc.industry ?? 'Not specified',
      employee_count: Number(doc.employeeCount ?? 0),
      created_at: iso(doc.createdAt) ?? new Date().toISOString(),
      settings: doc.settings ?? {},
    }),
  },
  {
    collection: 'workspaces',
    table: 'workspaces',
    map: (doc) => ({
      id: doc._id,
      organization_id: doc.organizationId,
      name: doc.name ?? '',
      is_demo: Boolean(doc.isDemo),
      is_default: Boolean(doc.isDefault),
      created_at: iso(doc.createdAt) ?? new Date().toISOString(),
      owner_user_id: doc.ownerUserId ?? '',
    }),
  },
  {
    collection: 'users',
    table: 'users',
    map: (doc) => ({
      id: doc._id,
      organization_id: doc.organizationId,
      email: String(doc.email ?? '').toLowerCase(),
      name: doc.name ?? '',
      job_title: doc.jobTitle ?? '',
      role: doc.role ?? 'member',
      is_demo_user: Boolean(doc.isDemoUser),
      // Hashes are copied verbatim. Passwords are never decoded, re-hashed or
      // weakened — every existing login keeps working.
      password_hash: doc.passwordHash,
      created_at: iso(doc.createdAt) ?? new Date().toISOString(),
      last_login_at: iso(doc.lastLoginAt),
    }),
  },
  {
    collection: 'evidence',
    table: 'evidence',
    map: (doc) => ({
      id: doc._id,
      organization_id: doc.organizationId,
      workspace_id: doc.workspaceId,
      file_name: doc.fileName ?? '',
      file_extension: doc.fileExtension ?? '',
      mime_type: doc.mimeType ?? 'application/octet-stream',
      size_bytes: Number(doc.sizeBytes ?? 0),
      category: doc.category ?? 'Uncategorised',
      source: doc.source === 'demo' ? 'demo' : 'upload',
      source_ref: doc.sourceRef ?? null,
      uploaded_at: iso(doc.uploadedAt) ?? new Date().toISOString(),
      uploaded_by: doc.uploadedBy ?? '',
      status: doc.status ?? 'needs_review',
      framework_keys: Array.isArray(doc.frameworkKeys) ? doc.frameworkKeys : [],
      content: doc.content ?? '',
      summary: doc.summary ?? '',
      size_on_disk: doc.sizeOnDisk ?? null,
      created_by_user: doc.createdByUser ?? null,
      // MongoDB never stored the original bytes, so there is nothing to move
      // into Supabase Storage. New uploads are retained from now on.
      storage_bucket: null,
      storage_path: null,
    }),
  },
  {
    collection: 'reports',
    table: 'reports',
    map: (doc) => ({
      id: doc._id,
      organization_id: doc.organizationId,
      workspace_id: doc.workspaceId,
      name: doc.name ?? '',
      framework_key: doc.frameworkKey ?? 'soc2',
      company_name: doc.companyName ?? '',
      file_name: doc.fileName ?? '',
      generated_at: iso(doc.generatedAt) ?? new Date().toISOString(),
      status: doc.status ?? 'ready',
      score_index: Math.max(0, Math.min(100, Number(doc.scoreIndex ?? 0))),
      summary: doc.summary ?? {},
      requested_by: doc.requestedBy ?? '',
    }),
  },
  {
    collection: 'auditevents',
    table: 'audit_events',
    map: (doc) => ({
      id: doc._id,
      organization_id: doc.organizationId ?? 'unknown',
      actor: doc.actor ?? '',
      action: doc.action ?? '',
      target: doc.target ?? '',
      at: iso(doc.at) ?? new Date().toISOString(),
    }),
  },
];

const BATCH = 200;
const mongo = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10_000 });
let exitCode = 0;

try {
  await mongo.connect();
  const db = mongo.db(mongoDbName);

  console.log(apply ? 'Mode: APPLY (writing to Supabase)' : 'Mode: DRY RUN (no writes) — pass --apply to write');

  for (const step of PLAN) {
    const docs = await db.collection(step.collection).find({}).toArray();
    console.log(`\n${step.collection} → ${step.table}: ${docs.length} document(s)`);
    if (docs.length === 0) continue;

    const rows = docs.map(step.map).filter((row) => row.id);
    if (!apply) {
      console.log(`  (dry run) would insert ${rows.length} row(s)`);
      continue;
    }

    for (let offset = 0; offset < rows.length; offset += BATCH) {
      const chunk = rows.slice(offset, offset + BATCH);
      const { error } = await supabase
        .from(step.table)
        .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
      if (error) {
        console.error(`  ✗ rows ${offset}–${offset + chunk.length - 1}: ${redact(error)}`);
        exitCode = 1;
      } else {
        console.log(`  ✓ rows ${offset}–${offset + chunk.length - 1}`);
      }
    }
  }

  console.log(
    exitCode === 0
      ? '\nDone. Re-running this script is safe: existing rows are never overwritten.'
      : '\nFinished with errors — see above. Nothing was overwritten.',
  );
} catch (error) {
  console.error(`Migration failed: ${redact(error)}`);
  exitCode = 1;
} finally {
  await mongo.close().catch(() => {});
}

process.exit(exitCode);
