/**
 * API client.
 *
 * The web app talks to its own origin (`/api`), so there is no CORS setup and
 * no API base URL to configure. Set VITE_API_BASE_URL only when the API is
 * hosted separately.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// `import.meta.env` is injected by Vite; read it defensively so this module can
// also be imported by tooling (tests, smoke checks) outside the bundler.
const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const API_BASE = viteEnv.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';
const SESSION_KEY = 'complylens.session';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type StoredSession = {
  token: string;
  expiresAt: string;
  user: { id: string; name: string; email: string; isDemoUser: boolean };
  organizationId: string;
  workspaceId: string | null;
};

export function readSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.token) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: StoredSession | null): void {
  try {
    if (!session) window.localStorage.removeItem(SESSION_KEY);
    else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage may be unavailable in private modes — the app still works in-memory */
  }
}

export function authToken(): string | null {
  return readSession()?.token ?? null;
}

/** Subscribe to auth changes so the app can redirect on sign-out. */
const authListeners = new Set<() => void>();
export function onAuthChange(listener: () => void): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}
function notifyAuthChange(): void {
  for (const listener of authListeners) listener();
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; formData?: FormData; signal?: AbortSignal; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, formData, signal, auth = true } = options;
  const headers: Record<string, string> = { accept: 'application/json' };

  if (auth) {
    const token = authToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  if (body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', 'Cannot reach the ComplyLens API. Check that the server is running.');
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const shape = (payload ?? {}) as { error?: { code?: string; message?: string; details?: unknown } };
    const message = shape.error?.message ?? `Request failed with status ${response.status}.`;
    if (response.status === 401 && auth) {
      writeSession(null);
      notifyAuthChange();
    }
    throw new ApiError(response.status, shape.error?.code ?? 'error', message, shape.error?.details);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options: { signal?: AbortSignal; auth?: boolean } = {}) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options: { signal?: AbortSignal; formData?: FormData; auth?: boolean } = {}) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export type AsyncState<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** True while a refetch is in flight but data is already present. */
  refreshing: boolean;
  refetch: () => void;
};

/**
 * Minimal data hook: one request per dependency change, abort on unmount,
 * no caching library required.
 */
export function useApi<T>(
  path: string | null,
  options: { deps?: unknown[]; auth?: boolean; enabled?: boolean } = {},
): AsyncState<T> {
  const { deps = [], auth = true, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(path) && enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  const hasData = useRef(false);

  useEffect(() => {
    if (!path || !enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    if (hasData.current) setRefreshing(true);
    else setLoading(true);

    api
      .get<T>(path, { signal: controller.signal, auth })
      .then((result) => {
        setData(result);
        setError(null);
        hasData.current = true;
      })
      .catch((caught: unknown) => {
        if ((caught as Error).name === 'AbortError') return;
        setError(caught as ApiError);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, auth, nonce, ...deps]);

  const refetch = useCallback(() => setNonce((value) => value + 1), []);
  return { data, error, loading, refreshing, refetch };
}

/** Debounce any fast-changing value (search boxes, filters). */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/** Trigger a browser download for an authenticated endpoint (e.g. report PDF). */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const token = authToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'download_failed', 'The document could not be generated. Please try again.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);
}

export { notifyAuthChange };
