/**
 * Fixture used by test/session-secret.test.ts.
 *
 * `server/src/config.ts` validates SESSION_SECRET at module load time and
 * throws synchronously when the deployment is unsafe. That check can only be
 * observed once per process (the module is cached after the first import), so
 * it is exercised here in a disposable child process for each environment
 * combination instead of inside the main Vitest worker.
 */
import { config } from '../../src/config.ts';

// Never print the secret itself — only booleans derived from it.
process.stdout.write(
  `CONFIG_OK ${JSON.stringify({
    isProduction: config.isProduction,
    secretIsEphemeral: config.session.secretIsEphemeral,
  })}\n`,
);
