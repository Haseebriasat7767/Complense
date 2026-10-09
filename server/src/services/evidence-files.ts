/**
 * Original evidence files — private Supabase Storage.
 *
 * Before this migration the uploaded bytes were parsed in memory and then
 * discarded; only the extracted text survived. With Supabase available the
 * original file is now retained in a PRIVATE bucket so a customer can download
 * exactly what they uploaded after a refresh, a new serverless instance or a
 * redeployment.
 *
 * Security properties:
 *   • the bucket is private — there is no public URL, ever;
 *   • object keys are organisation/workspace scoped AND carry 32 hex chars of
 *     randomness, so they cannot be guessed or enumerated from an evidence id;
 *   • every read goes through `GET /api/evidence/:id/file`, which authenticates
 *     the session and re-checks `organization_id` in the database query before
 *     the server streams the object with its server-only key;
 *   • an upload that cannot be persisted is cleaned up, so no orphaned object
 *     or orphaned row is left behind.
 *
 * When the active store is the in-memory demo store, retention is disabled and
 * the previous behaviour (text only) is preserved exactly.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getStore } from '../store/index.js';
import { sanitizeDbError } from '../store/supabase-client.js';
import { SupabaseStore } from '../store/supabase.js';

export type StoredEvidenceFile = {
  bucket: string;
  path: string;
};

/** Narrow the active store to the Supabase one, or null. */
function supabaseStore(): SupabaseStore | null {
  try {
    const store = getStore();
    return store instanceof SupabaseStore ? store : null;
  } catch {
    return null;
  }
}

export function isEvidenceFileStorageEnabled(): boolean {
  return config.supabase.retainOriginalFiles && supabaseStore() !== null;
}

/**
 * `org/<orgId>/ws/<wsId>/<evidenceId>-<32 hex>.<ext>`
 *
 * The random suffix makes the key non-guessable even for someone who knows the
 * evidence id; the org/ws prefix keeps objects sorted inside the tenant
 * boundary and makes a future storage-level policy straightforward.
 */
export function buildEvidenceObjectPath(input: {
  organizationId: string;
  workspaceId: string;
  evidenceId: string;
  extension: string;
}): string {
  const safe = (value: string) => value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
  const extension = safe(input.extension.replace(/^\./, '').toLowerCase()) || 'bin';
  const token = crypto.randomBytes(16).toString('hex');
  return [
    'org',
    safe(input.organizationId),
    'ws',
    safe(input.workspaceId),
    `${safe(input.evidenceId)}-${token}.${extension}`,
  ].join('/');
}

/**
 * Upload the original bytes. Returns null when retention is disabled (memory
 * store / explicitly turned off) — the caller then behaves exactly as before.
 * Throws when retention is enabled but the upload fails, so the route can
 * refuse the request instead of silently losing the file.
 */
export async function putEvidenceFile(input: {
  organizationId: string;
  workspaceId: string;
  evidenceId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<StoredEvidenceFile | null> {
  const store = supabaseStore();
  if (!store || !config.supabase.retainOriginalFiles) return null;

  const bucket = config.supabase.evidenceBucket;
  const objectPath = buildEvidenceObjectPath({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    evidenceId: input.evidenceId,
    extension: path.extname(input.fileName),
  });

  const { error } = await store.supabase.storage.from(bucket).upload(objectPath, input.bytes, {
    contentType: input.mimeType || 'application/octet-stream',
    upsert: false,
    // Private bucket: no caching intermediary should ever hold evidence.
    cacheControl: 'no-store',
  });

  if (error) {
    const reason = sanitizeDbError(error);
    logger.error('Evidence file upload to Supabase Storage failed', {
      bucket,
      // The file name is customer metadata but not content; keep it short.
      fileName: input.fileName.slice(0, 80),
      reason,
    });
    throw new Error(`Evidence file could not be stored: ${reason}`);
  }

  return { bucket, path: objectPath };
}

/** Best-effort cleanup. Used to compensate a failed create/update. */
export async function removeEvidenceFile(file: Partial<StoredEvidenceFile> | null | undefined): Promise<void> {
  if (!file?.path) return;
  const store = supabaseStore();
  if (!store) return;

  const bucket = file.bucket || config.supabase.evidenceBucket;
  const { error } = await store.supabase.storage.from(bucket).remove([file.path]);
  if (error) {
    logger.warn('Orphaned evidence object could not be removed', {
      bucket,
      reason: sanitizeDbError(error),
    });
  }
}

/**
 * Download the original bytes for an evidence record the caller is already
 * authorised for. The caller MUST have loaded the record with
 * `store.getEvidence(id, session.org)` so the organisation scope is enforced
 * by the database query, not by the object path.
 */
export async function getEvidenceFile(
  file: Partial<StoredEvidenceFile> | null | undefined,
): Promise<Buffer | null> {
  if (!file?.path) return null;
  const store = supabaseStore();
  if (!store) return null;

  const bucket = file.bucket || config.supabase.evidenceBucket;
  const { data, error } = await store.supabase.storage.from(bucket).download(file.path);
  if (error || !data) {
    logger.warn('Evidence object could not be read', {
      bucket,
      reason: error ? sanitizeDbError(error) : 'empty response',
    });
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}
