import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useBusiness } from '@/hooks/useBusiness';

/**
 * Sends a brand-new owner through the setup wizard once.
 * A business is "set up" as soon as onboarded_at is stamped.
 * Staff who join an existing business are never affected, because the
 * business they belong to is already onboarded.
 */
const OnboardingGate = ({ children }: { children: ReactNode }) => {
  const { currentBusiness, isLoading } = useBusiness();
  const location = useLocation();

  if (isLoading || !currentBusiness) return <>{children}</>;
  if (location.pathname === '/onboarding') return <>{children}</>;
  if (currentBusiness.onboarded_at) return <>{children}</>;

  return <Navigate to="/onboarding" replace />;
};

export default OnboardingGate;
