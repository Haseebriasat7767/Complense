/**
 * Store factory. Supabase is the persistent production store. If it is
 * unavailable during startup, production stays online in clearly-labelled
 * demo mode instead of crashing every API request. Demo data resets on restart.
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
      if (!config.isProduction) throw error;

      // Keep the demo available if production credentials or database grants
      // are wrong. Health output exposes the reason; this is not persistence.
      logger.error('Supabase initialization failed — using in-memory demo mode; data will not persist.', {
        reason,
      });
      const memory = new MemoryStore(`Supabase unavailable: ${reason}`);
      await memory.init();
      store = memory;
      return store;
    }
  }

  if (config.database.supabaseUrl || config.database.supabaseSecretKey) {
    if (config.isProduction) {
      logger.warn('Supabase configuration is incomplete — using the in-memory demo store as an emergency demo fallback. Set SUPABASE_URL and SUPABASE_SECRET_KEY to enable persistence.');
    } else {
      throw new Error('Supabase configuration is incomplete. Set both SUPABASE_URL and SUPABASE_SECRET_KEY.');
    }
  } else {
    logger.info('Supabase not configured — using the in-memory demo store');
  }

  const memory = new MemoryStore(config.isProduction
    ? 'SUPABASE_URL or SUPABASE_SECRET_KEY is missing in Vercel Production'
    : undefined);
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
