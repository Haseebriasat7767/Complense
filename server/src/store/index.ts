/**
 * Store factory: MongoDB when configured and reachable, otherwise in-memory.
 */
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { Store } from './store.js';
import { MemoryStore } from './memory.js';

let store: Store | null = null;

export async function initStore(): Promise<Store> {
  if (store) return store;

  if (config.database.uri) {
    const { MongoStore } = await import('./mongo.js');
    const mongo = await MongoStore.connect();
    if (mongo) {
      try {
        await mongo.init();
        store = mongo;
        return store;
      } catch (error) {
        logger.warn('MongoDB initialisation failed — falling back to in-memory store', {
          reason: error instanceof Error ? error.message : 'unknown',
        });
        await mongo.close();
      }
    }
  } else {
    logger.info('MONGODB_URI not set — using the in-memory demo store');
  }

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
