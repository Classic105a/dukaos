import { useState, useEffect, useCallback, useMemo, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusiness } from './useBusiness';

interface Branch {
  id: string;
  name: string;
  business_id: string;
  location: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  website: string | null;
  mpesa_till_number: string | null;
  mpesa_paybill_number: string | null;
  mpesa_account_number: string | null;
  kra_pin: string | null;
  receipt_footer_message: string | null;
  logo_url: string | null;
  is_headquarters: boolean | null;
  is_active: boolean | null;
}

interface BranchContextType {
  branches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch) => void;
  loading: boolean;
  refetch: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

const branchKey = (businessId: string) => `currentBranchId:${businessId}`;

/**
 * Branches are always scoped to the SELECTED business. Switching business
 * clears the branch list immediately (no stale branch from the previous
 * tenant) and re-resolves the active branch, remembered per business.
 */
export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const { user: authUser } = useAuth();
  // Depend on the user id only — token refreshes replace the user object and
  // previously re-triggered the branch fetch + branch_users upsert loop.
  const userId = authUser?.id ?? null;
  const user = useMemo(() => (userId ? { id: userId } : null), [userId]);
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id ?? null;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranches = useCallback(async () => {
    if (!user || !businessId) {
      setBranches([]);
      setCurrentBranch(null);
      setLoading(!!user && !businessId ? true : false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('is_headquarters', { ascending: false });
      if (error) throw error;

      const list = (data || []) as Branch[];
      setBranches(list);
      const savedId = localStorage.getItem(branchKey(businessId)) ?? localStorage.getItem('currentBranchId');
      const selected = list.find(b => b.id === savedId) || list[0] || null;
      setCurrentBranch(selected);
      if (selected) {
        localStorage.setItem(branchKey(businessId), selected.id);
        localStorage.setItem('currentBranchId', selected.id);
        await supabase
          .from('branch_users')
          .upsert(
            { branch_id: selected.id, user_id: user.id, is_default: false },
            { onConflict: 'branch_id,user_id' }
          );
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoading(false);
    }
  }, [user, businessId]);

  useEffect(() => {
    // Drop previous tenant's branches synchronously before refetching.
    setBranches([]);
    setCurrentBranch(null);
    fetchBranches();
  }, [fetchBranches]);

  const handleSetCurrentBranch = async (branch: Branch) => {
    setCurrentBranch(branch);
    localStorage.setItem('currentBranchId', branch.id);
    if (branch.business_id) localStorage.setItem(branchKey(branch.business_id), branch.id);
    if (user) {
      const { error } = await supabase
        .from('branch_users')
        .upsert(
          { branch_id: branch.id, user_id: user.id, is_default: false },
          { onConflict: 'branch_id,user_id' }
        );
      if (error) console.error('Failed to assign user to branch:', error);
    }
  };

  return (
    <BranchContext.Provider value={{
      branches,
      currentBranch,
      setCurrentBranch: handleSetCurrentBranch,
      loading,
      refetch: fetchBranches,
    }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};
