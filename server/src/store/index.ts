/**
 * Store factory.
 *
 * Production ALWAYS uses Supabase PostgreSQL. There is no silent fallback:
 * if the configuration is missing or the database is unreachable, startup
 * fails with an actionable error that names the missing variable keys (never
 * their values). Losing customer uploads to an invisible in-memory store is a
 * worse failure than refusing to boot.
 *
 * Outside production, the in-memory demo store is still available for a
 * zero-setup local demo and for the test suite.
 */
import { config, missingSupabaseEnv, resolveStoreDriver } from '../config.js';
import { logger } from '../logger.js';
import type { Store } from './store.js';
import { MemoryStore } from './memory.js';
import { sanitizeDbError } from './supabase-client.js';

let store: Store | null = null;

/**
 * Classify a startup failure so operators can tell a missing variable from a
 * DNS problem, an auth failure or an unapplied migration. Returns a short,
 * credential-free label plus the sanitised reason.
 */
export function classifyStoreFailure(error: unknown): { category: string; hint: string } {
  const message = sanitizeDbError(error).toLowerCase();

  if (message.includes('missing environment variable')) {
    return {
      category: 'configuration',
      hint: 'Set SUPABASE_URL and SUPABASE_SECRET_KEY in the deployment environment.',
    };
  }
  if (message.includes('schema is missing') || message.includes('does not exist') || message.includes('schema cache')) {
    return {
      category: 'schema',
      hint: 'Apply supabase/migrations/ to this project (see supabase/README.md), then redeploy.',
    };
  }
  if (message.includes('invalid api key') || message.includes('jwt') || message.includes('401') || message.includes('unauthorized')) {
    return {
      category: 'authentication',
      hint: 'SUPABASE_SECRET_KEY is rejected by the project. Re-copy the secret (service role) key.',
    };
  }
  if (
    message.includes('enotfound') ||
    message.includes('eai_again') ||
    message.includes('econnrefused') ||
    message.includes('timed out') ||
    message.includes('fetch failed') ||
    message.includes('network')
  ) {
    return {
      category: 'network',
      hint: 'The Supabase host could not be reached. Check SUPABASE_URL and that the project is not paused.',
    };
  }
  return { category: 'unknown', hint: 'See the sanitised reason above.' };
}

export async function initStore(): Promise<Store> {
  if (store) return store;

  const driver = resolveStoreDriver();

  if (driver === 'memory') {
    logger.warn('Using the in-memory demo store — data is NOT persisted and resets on restart', {
      reason: missingSupabaseEnv().length > 0 ? 'Supabase is not configured' : 'STORE_DRIVER=memory',
      nodeEnv: config.nodeEnv,
    });
    const memory = new MemoryStore();
    await memory.init();
    store = memory;
    return store;
  }

  const { SupabaseStore } = await import('./supabase.js');
  try {
    const supabase = SupabaseStore.create();
    await supabase.init();
    logger.info('Connected to Supabase PostgreSQL', {
      schema: config.supabase.schema,
      // Project reference only — never the URL, the key or any credential.
      project: projectRef(config.supabase.url),
    });
    store = supabase;
    return store;
  } catch (error) {
    const reason = sanitizeDbError(error);
    const { category, hint } = classifyStoreFailure(error);
    logger.error('Supabase initialisation failed — refusing to start without a persistent store', {
      category,
      reason,
      hint,
    });
    throw new Error(`Supabase initialisation failed (${category}): ${reason} ${hint}`);
  }
}

/** `https://abcdefgh.supabase.co` -> `abcdefgh`. Not a secret. */
function projectRef(url: string): string {
  const match = /^https?:\/\/([A-Za-z0-9-]+)\./.exec(url);
  return match?.[1] ?? 'unknown';
}

export function getStore(): Store {
  if (!store) throw new Error('Store has not been initialised yet.');
  return store;
}

/** Test-only: inject a store (e.g. backed by a fake Supabase client). */
export function setStoreForTesting(next: Store | null): void {
  store = next;
}

export async function closeStore(): Promise<void> {
  if (!store) return;
  await store.close();
  store = null;
}

export type { Store } from './store.js';
