/**
 * Startup behaviour of the store factory.
 *
 * The rule this migration introduces: **production never silently falls back
 * to the in-memory store.** Missing configuration or an unreachable database
 * must stop the boot with an actionable, credential-free error.
 *
 * `src/config.ts` reads the environment once at module load, so every scenario
 * runs in a disposable child process via `tsx`.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
const fixture = path.join(here, 'fixtures', 'load-store.mts');

const PROD_SECRET = 'a-long-randomly-generated-production-secret-value-123456';

function boot(env: Record<string, string>) {
  return spawnSync(tsx, [fixture], {
    cwd: repoRoot,
    env: {
      ...process.env,
      // Clean slate regardless of the developer's shell.
      NODE_ENV: '',
      SESSION_SECRET: '',
      STORE_DRIVER: '',
      SUPABASE_URL: '',
      SUPABASE_SECRET_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_TIMEOUT_MS: '2000',
      ...env,
    },
    encoding: 'utf8',
    timeout: 40_000,
  });
}

/** Each case spawns a real child process through tsx; allow for cold starts. */
const SPAWN_TIMEOUT = 45_000;

describe('store startup', () => {
  it('uses the in-memory store outside production when Supabase is not configured', () => {
    const result = boot({ NODE_ENV: 'development' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('STORE_OK');
    // The dev logger also writes to stdout; pick the contract line.
    const line = result.stdout.split('\n').find((entry) => entry.startsWith('STORE_OK')) ?? '';
    const parsed = JSON.parse(line.slice('STORE_OK '.length)) as {
      kind: string;
      persistent: boolean;
    };
    expect(parsed.kind).toBe('memory');
    expect(parsed.persistent).toBe(false);
    // …and it says so loudly.
    expect(result.stderr).toMatch(/in-memory demo store/i);
  }, SPAWN_TIMEOUT);

  it('refuses to boot in production without Supabase configuration, naming the missing keys', () => {
    const result = boot({ NODE_ENV: 'production', SESSION_SECRET: PROD_SECRET });

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('STORE_OK');
    expect(result.stderr).toContain('SUPABASE_URL');
    expect(result.stderr).toContain('SUPABASE_SECRET_KEY');
    expect(result.stderr).toMatch(/never falls back to the in-memory store in\s+production/i);
    // No MongoDB leftovers in the guidance.
    expect(result.stderr).not.toContain('MONGODB_URI');
  }, SPAWN_TIMEOUT);

  it('refuses STORE_DRIVER=memory in production', () => {
    const result = boot({
      NODE_ENV: 'production',
      SESSION_SECRET: PROD_SECRET,
      STORE_DRIVER: 'memory',
      SUPABASE_URL: 'https://example-project.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_placeholder_value_for_tests',
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('STORE_OK');
    expect(result.stderr).toMatch(/STORE_DRIVER=memory is not allowed in production/i);
  }, SPAWN_TIMEOUT);

  it('fails fast in production when the database is unreachable — no memory fallback', () => {
    const result = boot({
      NODE_ENV: 'production',
      SESSION_SECRET: PROD_SECRET,
      // Closed port: a connection failure, reproducible without the internet.
      SUPABASE_URL: 'http://127.0.0.1:9/',
      SUPABASE_SECRET_KEY: 'sb_secret_placeholder_value_for_tests',
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('STORE_OK');
    expect(result.stdout).not.toContain('memory');
    expect(result.stderr).toContain('STORE_FAIL');
    expect(result.stderr).toMatch(/Supabase initialisation failed/i);
  }, SPAWN_TIMEOUT);

  it('never prints the Supabase secret key, whatever happens', () => {
    const secret = 'sb_secret_THIS_MUST_NEVER_APPEAR_IN_LOGS_0123456789';
    const result = boot({
      NODE_ENV: 'production',
      SESSION_SECRET: PROD_SECRET,
      SUPABASE_URL: 'http://127.0.0.1:9/',
      SUPABASE_SECRET_KEY: secret,
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain(secret);
    expect(result.stderr).not.toContain(secret);
  }, SPAWN_TIMEOUT);

  it('rejects an unknown STORE_DRIVER value instead of guessing', () => {
    const result = boot({ NODE_ENV: 'development', STORE_DRIVER: 'postgres' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/STORE_DRIVER must be one of/i);
  }, SPAWN_TIMEOUT);

  it('accepts the legacy SUPABASE_SERVICE_ROLE_KEY name', () => {
    // Connection still fails (closed port) — the point is that the driver was
    // selected, i.e. the alias satisfied the configuration check.
    const result = boot({
      NODE_ENV: 'production',
      SESSION_SECRET: PROD_SECRET,
      SUPABASE_URL: 'http://127.0.0.1:9/',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_placeholder_value_for_tests',
    });

    expect(result.stderr).not.toContain('SUPABASE_SECRET_KEY');
    expect(result.stderr).toMatch(/Supabase initialisation failed/i);
  }, SPAWN_TIMEOUT);
});
