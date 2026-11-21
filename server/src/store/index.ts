/**
 * Store factory. Supabase is the persistent production store.
 *
 * Production must fail closed when Supabase is missing or unavailable. Falling
 * back to per-instance memory storage can make uploads/reports appear to save
 * while silently losing them after a cold start or instance recycle.
 */
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { Store } from './store.js';
import { MemoryStore } from './memory.js';

let store: Store | null = null;

export async function initStore(): Promise<Store> {
  if (store) return store;

  const hasSupabaseConfig = Boolean(config.database.supabaseUrl && config.database.supabaseSecretKey);
  if (hasSupabaseConfig) {
    try {
      const { SupabaseStore } = await import('./supabase.js');
      const persistent = SupabaseStore.connect();
      await persistent.init();
      store = persistent;
      return store;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('Supabase initialization failed.', { reason });
      if (config.isProduction) {
        throw new Error(
          'Production startup blocked: Supabase is unavailable. Refusing to use temporary in-memory storage and risk losing evidence or reports.',
          { cause: error },
        );
      }
      throw error;
    }
  }

  if (config.isProduction) {
    throw new Error(
      'Production startup blocked: SUPABASE_URL and SUPABASE_SECRET_KEY are required. Refusing to use temporary in-memory storage.',
    );
  }

  if (config.database.supabaseUrl || config.database.supabaseSecretKey) {
    throw new Error('Supabase configuration is incomplete. Set both SUPABASE_URL and SUPABASE_SECRET_KEY.');
  }

  logger.info('Supabase not configured — using the in-memory store for local development/tests.');
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
