/**
 * Fixture used by test/store-startup.test.ts.
 *
 * Boots the store exactly the way `server/src/index.ts` and `api/index.mjs` do
 * and prints a single machine-readable line. Run in a disposable child process
 * because `src/config.ts` reads the environment once at module load.
 *
 * Output contract:
 *   STORE_OK {"kind":"memory","persistent":false}   → startup succeeded
 *   STORE_FAIL <sanitised message>                  → startup refused (exit 1)
 *
 * Nothing secret is ever printed: only the store kind and the error message,
 * which the store layer has already sanitised.
 */
import { initStore } from '../../src/store/index.ts';

try {
  const store = await initStore();
  process.stdout.write(
    `STORE_OK ${JSON.stringify({ kind: store.kind, persistent: store.persistent })}\n`,
  );
  process.exit(0);
} catch (error) {
  process.stderr.write(`STORE_FAIL ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
