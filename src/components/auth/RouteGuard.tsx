import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useBusiness } from '@/hooks/useBusiness';
import { canAccess, homeFor } from '@/lib/nav-access';

/**
 * Redirects away from routes the current business role cannot use.
 * Not a security boundary — RLS/RPCs still protect the data.
 */
export const RouteGuard = ({ children }: { children: ReactNode }) => {
  const { pathname, search } = useLocation();
  const { permissions, isLoading } = usePermissions();
  const { businesses, currentBusiness, isLoading: bizLoading } = useBusiness();

  // While loading, or before any business exists (onboarding), render as-is.
  if (isLoading || bizLoading || businesses.length === 0) return <>{children}</>;
  // Business list loaded but selection not applied yet — wait, don't redirect.
  if (!currentBusiness) return null;
  if (pathname === '/settings' && !search) {
    if (!permissions.canManageUsers) return <Navigate to="/settings?tab=profile" replace />;
    return <>{children}</>;
  }
  if (!canAccess(permissions, `${pathname}${search}`)) {
    const home = homeFor(permissions);
    if (home === pathname) return <>{children}</>;
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
};

export default RouteGuard;
