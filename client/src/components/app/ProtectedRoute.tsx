import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { AppLoadingShell } from './AppShell';

/**
 * Route guard for /app/*.
 *
 * Demo mode still requires a session — it is issued instantly by the demo
 * button — so protected routes, org scoping and session expiry behave exactly
 * as they do for a real account.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, ready, context } = useSession();
  const location = useLocation();

  if (!ready) return <AppLoadingShell />;

  if (!session?.token || !context) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}
