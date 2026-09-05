import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBranches = async () => {
    if (!user) {
      setBranches([]);
      setCurrentBranch(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('is_headquarters', { ascending: false });

      if (error) throw error;

      setBranches(data || []);
      
      // Set default branch from localStorage or first available
      const savedBranchId = localStorage.getItem('currentBranchId');
      const savedBranch = data?.find(b => b.id === savedBranchId);
      
      const selectedBranch = savedBranch || (data && data.length > 0 ? data[0] : null);
      
      if (selectedBranch) {
        setCurrentBranch(selectedBranch);
        localStorage.setItem('currentBranchId', selectedBranch.id);
        
        // Auto-assign user to branch on load
        if (user) {
          await supabase
            .from('branch_users')
            .upsert(
              { branch_id: selectedBranch.id, user_id: user.id, is_default: false },
              { onConflict: 'branch_id,user_id' }
            );
        }
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    // fetchBranches is a plain closure re-created each render; keying on `user`
    // (the only input that should trigger a refetch) is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSetCurrentBranch = async (branch: Branch) => {
    setCurrentBranch(branch);
    localStorage.setItem('currentBranchId', branch.id);
    
    // Ensure user is assigned to this branch (for cashiers/managers)
    if (user) {
      const { error } = await supabase
        .from('branch_users')
        .upsert(
          { branch_id: branch.id, user_id: user.id, is_default: false },
          { onConflict: 'branch_id,user_id' }
        );
      
      if (error) {
        console.error('Failed to assign user to branch:', error);
      }
    }
  };

  return (
    <BranchContext.Provider value={{ 
      branches, 
      currentBranch, 
      setCurrentBranch: handleSetCurrentBranch, 
      loading,
      refetch: fetchBranches 
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
