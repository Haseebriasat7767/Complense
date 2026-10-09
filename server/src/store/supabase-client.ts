/**
 * Supabase client factory (server-only).
 *
 * Why the Data API client and not a direct PostgreSQL socket:
 *   • Vercel functions are short-lived and highly concurrent. A raw `pg` pool
 *     either exhausts Postgres connections or needs the transaction pooler plus
 *     careful prepared-statement settings. The Data API is plain HTTPS, so it
 *     is safe to create per cold start and needs no pooling.
 *   • The same client gives access to Supabase Storage for evidence files.
 *
 * The key used here is the Supabase **secret / service-role** key. It bypasses
 * RLS by design, so it must never reach the browser: it is read only from a
 * server-side variable (`SUPABASE_SECRET_KEY`), never from a `VITE_`/
 * `NEXT_PUBLIC_` variable, and never echoed into a response, a log line or an
 * error message.
 */
import { createClient, type SupabaseClient as GenericSupabaseClient } from '@supabase/supabase-js';
import { config, missingSupabaseEnv } from '../config.js';

/**
 * The schema name is configurable (`SUPABASE_DB_SCHEMA`), so the client is used
 * untyped at the generics level. Row shapes are validated by the explicit
 * mappers in `store/supabase.ts`, which is where the schema contract lives.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type SupabaseClient = GenericSupabaseClient<any, any, any, any, any>;

/**
 * Strip anything credential-shaped out of a message before it is logged or
 * returned. Supabase errors can echo the URL, and a misconfigured key can end
 * up inside a fetch error message.
 */
export function sanitizeDbError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);

  let message = raw
    .replace(/https?:\/\/[A-Za-z0-9-]+\.supabase\.(co|in|net)[^\s"']*/gi, '<supabase-url>')
    // Bare hostnames too: DNS errors read `getaddrinfo ENOTFOUND <ref>.supabase.co`.
    .replace(/[A-Za-z0-9-]+\.supabase\.(co|in|net)/gi, '<supabase-host>')
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, 'postgresql://***')
    .replace(/\b(sb_secret|sb_publishable)_[A-Za-z0-9._-]+/g, '<redacted-key>')
    .replace(/\beyJ[A-Za-z0-9._-]{20,}/g, '<redacted-token>')
    .replace(/(apikey|api_key|authorization|bearer|password|secret|token)([=:\s"']+)[^\s,;"']+/gi, '$1$2***');

  if (config.supabase.secretKey) message = message.split(config.supabase.secretKey).join('<redacted-key>');
  if (config.supabase.url) message = message.split(config.supabase.url).join('<supabase-url>');

  return message.slice(0, 500);
}

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

/** Abort any Supabase request that outruns SUPABASE_TIMEOUT_MS. */
function timeoutFetch(timeoutMs: number): typeof fetch {
  return async (input: FetchInput, init?: FetchInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const upstream = init?.signal;
    if (upstream) {
      if (upstream.aborted) controller.abort();
      else upstream.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted && !upstream?.aborted) {
        throw new Error(`Supabase request timed out after ${timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * Build the server-side Supabase client.
 * Throws a configuration error that names the missing keys (never their values).
 */
export function createSupabaseClient(): SupabaseClient {
  const missing = missingSupabaseEnv();
  if (missing.length > 0) {
    throw new Error(
      `Supabase is not configured. Missing environment variable(s): ${missing.join(', ')}.`,
    );
  }

  let url: URL;
  try {
    url = new URL(config.supabase.url);
  } catch {
    throw new Error('SUPABASE_URL is not a valid URL. Expected https://<project-ref>.supabase.co');
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('SUPABASE_URL must use https (http is only allowed for a local Supabase stack).');
  }

  return createClient(config.supabase.url, config.supabase.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: config.supabase.schema },
    global: {
      fetch: timeoutFetch(config.supabase.timeoutMs),
      headers: { 'x-application-name': 'complylens-ai' },
    },
  }) as SupabaseClient;
}
