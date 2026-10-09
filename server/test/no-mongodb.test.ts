/**
 * Regression guard: MongoDB/Mongoose must stay gone.
 *
 * The migration removed the Mongo store, the `mongoose` dependency and the
 * `MONGODB_URI` / `MONGODB_DB` configuration. The only place MongoDB may still
 * be mentioned is the deliberately retained, documented one-time export script
 * (`scripts/migrate-mongo-to-supabase.mjs`) and the migration notes that point
 * at it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.vercel']);

/** Files allowed to mention MongoDB, because they document or perform the one-time import. */
const ALLOWED = new Set([
  'scripts/migrate-mongo-to-supabase.mjs',
  'server/test/no-mongodb.test.ts',
  // Asserts the new error guidance does NOT mention MONGODB_URI.
  'server/test/store-startup.test.ts',
  'package.json',
  'package-lock.json',
  'README.md',
  'docs/DATABASE.md',
  'docs/DEPLOYMENT.md',
  'docs/ARCHITECTURE.md',
  'docs/SECURITY.md',
  'docs/MIGRATION-MONGODB-TO-SUPABASE.md',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(path.relative(repoRoot, full));
  }
  return out;
}

const files = walk(repoRoot).filter((file) =>
  /\.(ts|tsx|mts|mjs|js|json|sql|md|yml|yaml|example)$/.test(file) || file.endsWith('.env.example'),
);

describe('MongoDB removal', () => {
  it('has no Mongo code left in application sources', () => {
    // Historical prose in a comment is fine; executable Mongo code is not.
    const MONGO_CODE =
      /(from\s+['"]mongoose['"]|require\(['"]mongoose['"]\)|import\(['"]mongoose['"]\)|MongoStore|ObjectId|mongodb(\+srv)?:\/\/|\.lean\(\)|findByIdAndUpdate|deleteMany\()/;
    const offenders = files
      .filter((file) => file.startsWith('server/src/') || file.startsWith('client/src/') || file.startsWith('api/'))
      .filter((file) => MONGO_CODE.test(readFileSync(path.join(repoRoot, file), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('no longer ships a mongo store module', () => {
    expect(files).not.toContain('server/src/store/mongo.ts');
  });

  it('does not reference MONGODB_URI or MONGODB_DB outside the one-time import path', () => {
    const offenders = files
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => /MONGODB_(URI|DB)/.test(readFileSync(path.join(repoRoot, file), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('removed mongoose from every package manifest', () => {
    for (const manifest of ['package.json', 'server/package.json', 'client/package.json']) {
      const pkg = JSON.parse(readFileSync(path.join(repoRoot, manifest), 'utf8')) as Record<
        string,
        Record<string, string> | undefined
      >;
      for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
        expect(Object.keys(pkg[section] ?? {}), `${manifest}.${section}`).not.toContain('mongoose');
        expect(Object.keys(pkg[section] ?? {}), `${manifest}.${section}`).not.toContain('mongodb');
      }
    }
  });

  it('declares the Supabase client as a server dependency', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'server/package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies)).toContain('@supabase/supabase-js');
  });

  it('never reads a Supabase variable or key from the browser bundle', () => {
    // Documentation pages may *name* the server-side variables; what must never
    // happen is the client reading them at build time or embedding a key.
    const clientFiles = files.filter((file) => file.startsWith('client/'));
    for (const file of clientFiles) {
      const contents = readFileSync(path.join(repoRoot, file), 'utf8');
      expect(contents, file).not.toMatch(/VITE_SUPABASE/);
      expect(contents, file).not.toMatch(/NEXT_PUBLIC_SUPABASE/);
      expect(contents, file).not.toMatch(/sb_secret_/);
      expect(contents, file).not.toMatch(/import\.meta\.env\.[A-Z_]*SUPABASE/);
      expect(contents, file).not.toMatch(/process\.env\.[A-Z_]*SUPABASE/);
      expect(contents, file).not.toMatch(/@supabase\/supabase-js/);
      expect(contents, file).not.toMatch(/\beyJ[A-Za-z0-9._-]{20,}/);
    }
  });

  it('keeps secrets out of vercel.json and the Dockerfile', () => {
    for (const file of ['vercel.json', 'Dockerfile']) {
      const contents = readFileSync(path.join(repoRoot, file), 'utf8');
      expect(contents, file).not.toMatch(/sb_secret_/);
      expect(contents, file).not.toMatch(/SUPABASE_SECRET_KEY\s*[=:]\s*\S+/);
      expect(contents, file).not.toMatch(/supabase\.co/);
    }
  });

  it('.env.example contains placeholders only', () => {
    const contents = readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
    expect(contents).toContain('SUPABASE_URL=https://your-project-ref.supabase.co');
    expect(contents).toContain('SUPABASE_SECRET_KEY=sb_secret_replace_me');
    expect(contents).not.toMatch(/sb_secret_(?!replace_me)[A-Za-z0-9]{8,}/);
    expect(contents).not.toMatch(/MONGODB_URI=/);
  });
});
