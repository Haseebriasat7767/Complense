/**
 * Store factory. Production requires Supabase and never silently falls back to
 * ephemeral memory. Memory mode remains available for local demos and tests.
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
    const { SupabaseStore } = await import('./supabase.js');
    const persistent = SupabaseStore.connect();
    await persistent.init();
    store = persistent;
    return store;
  }

  if (config.isProduction) {
    throw new Error('Supabase is required in production. Set SUPABASE_URL and SUPABASE_SECRET_KEY in the deployment environment.');
  }

  if (config.database.supabaseUrl || config.database.supabaseSecretKey) {
    throw new Error('Supabase configuration is incomplete. Set both SUPABASE_URL and SUPABASE_SECRET_KEY.');
  }

  logger.info('Supabase not configured — using the in-memory demo store for local development only');
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
