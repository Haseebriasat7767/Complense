import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../src/config.js');
  vi.doUnmock('../src/store/supabase.js');
  vi.unstubAllGlobals();
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

describe('Supabase production initialization', () => {
  it('does not create demo users or evidence when demo mode is disabled', async () => {
    vi.doMock('../src/config.js', () => ({
      config: {
        isProduction: true,
        demoMode: false,
        database: {
          supabaseUrl: 'https://example.supabase.co',
          supabaseSecretKey: 'sb_secret_test_only',
        },
      },
    }));

    const fetchMock = vi.fn(async () => new Response('[]', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { SupabaseStore } = await import('../src/store/supabase.js');
    await SupabaseStore.connect().init();

    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
});
