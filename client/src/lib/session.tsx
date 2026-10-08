/**
 * Session context.
 *
 * Demo mode: "Try the Demo" requests a session for the seeded demo workspace —
 * no credentials, no sign-up. Real accounts use the same context.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, onAuthChange, readSession, writeSession, type StoredSession } from './api';
import type { SessionPayload, WorkspaceContext } from './types';

type SessionState = {
  session: StoredSession | null;
  context: WorkspaceContext | null;
  ready: boolean;
  loading: boolean;
  error: string | null;
  startDemo: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    name: string;
    email: string;
    password: string;
    organizationName: string;
    jobTitle?: string;
    seedDemo?: boolean;
  }) => Promise<{ persistence: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setWorkspace: (workspaceId: string) => void;
};

const SessionContext = createContext<SessionState | null>(null);

function persist(payload: SessionPayload): StoredSession {
  return {
    token: payload.token,
    expiresAt: payload.expiresAt,
    user: {
      id: payload.user.id,
      name: payload.user.name,
      email: payload.user.email,
      isDemoUser: payload.user.isDemoUser,
    },
    organizationId: payload.organization.id,
    workspaceId: payload.workspace?.id ?? null,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readSession());
  const [context, setContext] = useState<WorkspaceContext | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    const current = readSession();
    if (!current) {
      setContext(null);
      setReady(true);
      return;
    }
    try {
      const next = await api.get<WorkspaceContext>('/api/context');
      setContext(next);
      setError(null);
    } catch (caught) {
      setContext(null);
      setError(caught instanceof Error ? caught.message : 'Unable to load the workspace.');
      writeSession(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void loadContext();
    return onAuthChange(() => {
      setSession(readSession());
      void loadContext();
    });
  }, [loadContext]);

  useEffect(() => {
    // Keep the context fresh when a token appears in another tab.
    const onStorage = () => {
      setSession(readSession());
      void loadContext();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadContext]);

  const apply = useCallback(
    async (payload: SessionPayload) => {
      writeSession(persist(payload));
      setSession(readSession());
      await loadContext();
    },
    [loadContext],
  );

  const startDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.post<SessionPayload>('/api/auth/demo', undefined, { auth: false });
      await apply(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The demo workspace could not be opened.');
      throw caught;
    } finally {
      setLoading(false);
    }
  }, [apply]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const payload = await api.post<SessionPayload>('/api/auth/login', { email, password }, { auth: false });
        await apply(payload);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Sign in failed.');
        throw caught;
      } finally {
        setLoading(false);
      }
    },
    [apply],
  );

  const signup = useCallback<SessionState['signup']>(
    async (input) => {
      setLoading(true);
      setError(null);
      try {
        const payload = await api.post<SessionPayload>('/api/auth/signup', input, { auth: false });
        await apply(payload);
        return { persistence: payload.persistence };
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Account creation failed.');
        throw caught;
      } finally {
        setLoading(false);
      }
    },
    [apply],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* signing out locally is enough — the token is stateless */
    }
    writeSession(null);
    setSession(readSession());
    setContext(null);
  }, []);

  const setWorkspace = useCallback((workspaceId: string) => {
    const current = readSession();
    if (!current) return;
    writeSession({ ...current, workspaceId });
    setSession(readSession());
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      session,
      context,
      ready,
      loading,
      error,
      startDemo,
      login,
      signup,
      logout,
      refresh: loadContext,
      setWorkspace,
    }),
    [session, context, ready, loading, error, startDemo, login, signup, logout, loadContext, setWorkspace],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

export function isAuthenticated(session: StoredSession | null): boolean {
  return Boolean(session?.token);
}
