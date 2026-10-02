import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useBusiness } from '@/hooks/useBusiness';
import { useBranch } from '@/hooks/useBranch';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Sends a new owner through the setup wizard once (until onboarded_at is set).
 * Also sends an owner whose business has no branch back to the wizard, since
 * products, stock and the till all need a branch to work.
 * Staff are never redirected.
 */
const OnboardingGate = ({ children }: { children: ReactNode }) => {
  const { currentBusiness, isLoading } = useBusiness();
  const { branches, loading: branchesLoading } = useBranch();
  const { role } = usePermissions();
  const location = useLocation();

  if (isLoading || !currentBusiness) return <>{children}</>;
  if (location.pathname === '/onboarding') return <>{children}</>;
  if (!currentBusiness.onboarded_at) return <Navigate to="/onboarding" replace />;
  if (role === 'owner' && !branchesLoading && branches.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};

export default OnboardingGate;
