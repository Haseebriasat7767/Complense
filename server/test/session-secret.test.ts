/**
 * Production SESSION_SECRET safety net (TEST 12 / TEST 13).
 *
 * `server/src/config.ts` throws at import time when NODE_ENV=production and no
 * SESSION_SECRET is configured — a random per-boot secret is not safe for
 * serverless, where different invocations/instances must agree on the signing
 * key. That throw can only happen once per process (module caching), so each
 * scenario here boots a fresh child process via `tsx`.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
const fixture = path.join(here, 'fixtures', 'load-config.mts');

function runWithEnv(env: Record<string, string | undefined>) {
  const result = spawnSync(tsx, [fixture], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
      // Guarantee a clean slate regardless of the outer shell's environment.
      SESSION_SECRET: env.SESSION_SECRET ?? '',
      NODE_ENV: env.NODE_ENV ?? '',
    },
    encoding: 'utf8',
    timeout: 15_000,
  });
  return result;
}

describe('production SESSION_SECRET enforcement', () => {
  it('TEST 12: NODE_ENV=production without SESSION_SECRET fails fast with an actionable error', () => {
    const result = runWithEnv({ NODE_ENV: 'production', SESSION_SECRET: '' });

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('CONFIG_OK');
    // The error must actually explain what to do, not just fail silently.
    expect(result.stderr).toContain('SESSION_SECRET is required in production');
    expect(result.stderr.toLowerCase()).toContain('set a long random session_secret');
  });

  it('TEST 13: NODE_ENV=production with SESSION_SECRET set boots cleanly', () => {
    const result = runWithEnv({
      NODE_ENV: 'production',
      SESSION_SECRET: 'a-long-randomly-generated-production-secret-value-123456',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CONFIG_OK');
    const [, json] = result.stdout.trim().split(' ');
    const parsed = JSON.parse(json) as { isProduction: boolean; secretIsEphemeral: boolean };
    expect(parsed.isProduction).toBe(true);
    expect(parsed.secretIsEphemeral).toBe(false);
  });

  it('never prints the configured secret value anywhere in stdout/stderr', () => {
    const secret = 'super-secret-value-that-must-never-be-logged-ABC123';
    const result = runWithEnv({ NODE_ENV: 'production', SESSION_SECRET: secret });

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain(secret);
    expect(result.stderr).not.toContain(secret);
  });

  it('development mode still boots without SESSION_SECRET (ephemeral demo secret allowed)', () => {
    const result = runWithEnv({ NODE_ENV: 'development', SESSION_SECRET: '' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('CONFIG_OK');
    const [, json] = result.stdout.trim().split(' ');
    const parsed = JSON.parse(json) as { isProduction: boolean; secretIsEphemeral: boolean };
    expect(parsed.isProduction).toBe(false);
    expect(parsed.secretIsEphemeral).toBe(true);
  });
});
