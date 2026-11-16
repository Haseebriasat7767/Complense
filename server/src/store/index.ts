/**
 * Store factory.
 *
 * Production is fail-closed: Supabase is the only supported persistent store.
 * If it is missing or unavailable, startup aborts instead of silently serving
 * an in-memory store that would lose customer evidence and reports.
 *
 * MemoryStore is reserved for local development and automated tests.
 */
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { Store } from './store.js';
import { MemoryStore } from './memory.js';

let store: Store | null = null;

export async function initStore(): Promise<Store> {
  if (store) return store;

  const hasUrl = Boolean(config.database.supabaseUrl);
  const hasKey = Boolean(config.database.supabaseSecretKey);

  if (config.isProduction && (!hasUrl || !hasKey)) {
    throw new Error(
      'Production requires SUPABASE_URL and SUPABASE_SECRET_KEY. Refusing to start with volatile in-memory storage.',
    );
  }

  if (hasUrl !== hasKey) {
    throw new Error('Supabase configuration is incomplete. Set both SUPABASE_URL and SUPABASE_SECRET_KEY.');
  }

  if (hasUrl && hasKey) {
    try {
      const { SupabaseStore } = await import('./supabase.js');
      const persistent = SupabaseStore.connect();
      await persistent.init();
      store = persistent;
      return store;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('Supabase initialization failed; persistent storage is unavailable.', { reason });
      if (config.isProduction) {
        throw new Error(
          'Production startup aborted because Supabase is unavailable. In-memory fallback is disabled.',
        );
      }
      throw error;
    }
  }

  if (config.isProduction) {
    // Defensive guard: the production branch above should always have returned
    // or thrown before this point.
    throw new Error('Production requires a healthy Supabase persistent store.');
  }

  logger.info('Supabase not configured — using the in-memory development/test store');
  const memory = new MemoryStore();
  await memory.init();
  store = memory;
  return store;
}

export function getStore(): Store {
  if (!store) throw new Error('Store has not been initialised yet.');
  return store;
}

export async function closeStore(): Promise<void> {
  if (!store) return;
  await store.close();
  store = null;
}

export type { Store } from './store.js';
