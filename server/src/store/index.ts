/**
 * Store factory: MongoDB when configured and reachable, otherwise in-memory.
 *
 * When MongoDB is configured but unavailable, keep the demo usable while
 * exposing a sanitized diagnostic through /api/health so deployment problems
 * can be fixed instead of silently guessing.
 */
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { Store } from './store.js';
import { MemoryStore } from './memory.js';

let store: Store | null = null;

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+@/gi, '$1***@')
    .replace(/(password[=:\s]+)[^\s,;]+/gi, '$1***');
}

export async function initStore(): Promise<Store> {
  if (store) return store;

  if (config.database.uri) {
    const { MongoStore } = await import('./mongo.js');
    let mongoFailure: string | null = null;

    try {
      const mongo = await MongoStore.connect();
      await mongo.init();
      store = mongo;
      return store;
    } catch (error) {
      mongoFailure = safeErrorMessage(error);
      logger.warn('MongoDB initialisation failed — falling back to in-memory store', {
        reason: mongoFailure,
      });
    }

    const memory = new MemoryStore(mongoFailure ?? 'MongoDB connection failed for an unknown reason.');
    await memory.init();
    store = memory;
    return store;
  }

  logger.info('MONGODB_URI not set — using the in-memory demo store');
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
