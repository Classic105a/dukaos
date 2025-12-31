import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Branch {
  id: string;
  name: string;
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
  is_headquarters: boolean;
  is_active: boolean;
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
      
      if (savedBranch) {
        setCurrentBranch(savedBranch);
      } else if (data && data.length > 0) {
        setCurrentBranch(data[0]);
        localStorage.setItem('currentBranchId', data[0].id);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [user]);

  const handleSetCurrentBranch = (branch: Branch) => {
    setCurrentBranch(branch);
    localStorage.setItem('currentBranchId', branch.id);
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
