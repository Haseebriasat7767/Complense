import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../src/config.js');
  vi.doUnmock('../src/store/supabase.js');
});

describe('production store initialization', () => {
  it('refuses to start when Supabase credentials are missing', async () => {
    vi.doMock('../src/config.js', () => ({
      config: {
        isProduction: true,
        database: { supabaseUrl: '', supabaseSecretKey: '' },
      },
    }));

    const { initStore } = await import('../src/store/index.js');
    await expect(initStore()).rejects.toThrow(
      'Production requires SUPABASE_URL and SUPABASE_SECRET_KEY',
    );
  });

  it('refuses to fall back to memory when the configured Supabase database is unavailable', async () => {
    vi.doMock('../src/config.js', () => ({
      config: {
        isProduction: true,
        database: {
          supabaseUrl: 'https://example.supabase.co',
          supabaseSecretKey: 'sb_secret_test_only',
        },
      },
    }));
    vi.doMock('../src/store/supabase.js', () => ({
      SupabaseStore: {
        connect: () => ({
          init: vi.fn().mockRejectedValue(new Error('database unavailable')),
        }),
      },
    }));

    const { initStore } = await import('../src/store/index.js');
    await expect(initStore()).rejects.toThrow(
      'Production startup aborted because Supabase is unavailable',
    );
  });
});
