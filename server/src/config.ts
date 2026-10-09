/**
 * Runtime configuration.
 *
 * Every value is optional: with an empty environment ComplyLens boots in
 * DEMO MODE on an in-memory store with the deterministic local analysis
 * engine. Nothing throws because a key is missing.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Load `.env` from the repo root (and cwd) without adding a dotenv dependency. */
function loadEnvFiles(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      // Node >= 20.12 built-in dotenv parser. Existing vars win.
      process.loadEnvFile(file);
    } catch {
      /* ignore malformed env files — demo mode must still boot */
    }
  }
}

loadEnvFiles();

function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v.trim();
}

function num(name: string, fallback: number): number {
  const raw = str(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegativeInt(name: string, fallback: number): number {
  const raw = str(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = str(name).toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

const nodeEnv = str('NODE_ENV', str('VERCEL') ? 'production' : 'development');
const authRequired = bool('AUTH_REQUIRED', false);
const configuredSessionSecret = str('SESSION_SECRET');

// A stateless session token must use the same signing secret on every
// serverless invocation. Never silently generate a random secret in production:
// that makes a successful login fail on the next invocation with an invalid
// session signature.

/**
 * Serverless platforms cap the request body before it reaches the application
 * (Vercel rejects bodies above ~4.5 MB). The default upload limit is lowered on
 * those platforms so the user gets the app's own clear 413 message instead of a
 * platform-level failure. An explicit MAX_UPLOAD_MB always wins.
 */
const isServerless = Boolean(str('VERCEL') || str('AWS_LAMBDA_FUNCTION_NAME'));
const defaultUploadMb = isServerless ? 4 : 10;

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: num('PORT', 4000),
  host: str('HOST', '0.0.0.0'),
  // Trust forwarded client addresses only when the deployment has explicitly
  // declared the number of proxies in front of this process. Default 0 avoids
  // trusting user-supplied X-Forwarded-For values on direct deployments.
  trustProxyHops: nonNegativeInt('TRUST_PROXY_HOPS', 0),

  /** Demo mode is the default: seeded AcmeCloud workspace, instant demo login. */
  demoMode: bool('DEMO_MODE', !authRequired),
  authRequired,

  session: {
    secret: configuredSessionSecret || crypto.randomBytes(32).toString('hex'),
    secretIsEphemeral: !configuredSessionSecret,
    ttlHours: num('SESSION_TTL_HOURS', 12),
  },

  database: {
    supabaseUrl: str('SUPABASE_URL'),
    supabaseSecretKey: str('SUPABASE_SECRET_KEY') || str('SUPABASE_SERVICE_ROLE_KEY'),
  },

  ai: {
    provider: str('AI_PROVIDER', 'none').toLowerCase(),
    apiKey: str('AI_API_KEY'),
    baseUrl: str('AI_BASE_URL', 'https://api.openai.com/v1'),
    model: str('AI_MODEL', 'gpt-4o-mini'),
    allowExternal: bool('AI_ALLOW_EXTERNAL', false),
    timeoutMs: num('AI_TIMEOUT_MS', 20_000),
  },

  /**
   * Optional cross-origin allowlist. Empty (the default) means the API is
   * same-origin only, which is how the app is deployed by default. Set
   * CORS_ORIGINS when a separately hosted client (e.g. a Vercel deployment)
   * needs to call this API.
   */
  cors: {
    origins: str('CORS_ORIGINS')
      .split(',')
      .map((value) => value.trim().replace(/\/$/, ''))
      .filter(Boolean),
  },

  /**
   * Internal URL of the client service, injected by Vercel's service binding.
   * Available only at runtime (not during builds) when the server service has
   * a binding to the client service.  Use this to construct absolute URLs
   * pointing at the web client (e.g. for redirects, email links, or callbacks).
   * Empty when the variable is not set (standalone container deployment).
   */
  clientUrl: str('CLIENT_URL'),

  uploads: {
    maxBytes: num('MAX_UPLOAD_MB', defaultUploadMb) * 1024 * 1024,
    allowedExtensions: str('ALLOWED_UPLOAD_TYPES', 'pdf,docx,txt,csv')
      .split(',')
      .map((s) => s.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean),
  },

  /** Demo workspace + organisation labels (fictional). */
  demo: {
    organizationId: 'org_acmecloud',
    organizationName: 'AcmeCloud',
    workspaceId: 'ws_acmecloud_demo',
    workspaceName: 'AcmeCloud Demo Workspace',
    userEmail: 'demo@complylens.ai',
  },
} as const;

export type AppConfig = typeof config;

// Production deployments must provide a persistent signing key. Vercel can
// execute different requests on different instances, so an ephemeral key is
// not safe for authenticated routes.
if (config.isProduction && config.session.secretIsEphemeral) {
  throw new Error(
    'SESSION_SECRET is required in production. Set a long random SESSION_SECRET in the deployment environment before starting ComplyLens.',
  );
}

/** True when an external AI provider is configured AND explicitly allowed. */
export function isExternalAiEnabled(): boolean {
  return (
    config.ai.provider === 'openai-compatible' &&
    config.ai.apiKey.length > 0 &&
    config.ai.allowExternal
  );
}

/** Human-readable analysis mode used by the UI banner. */
export function analysisMode(): 'demo-analysis' | 'external-ai' {
  return isExternalAiEnabled() ? 'external-ai' : 'demo-analysis';
}
