import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Business {
  id: string;
  name: string;
  type: string;
  logo_url: string | null;
  currency: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  onboarded_at: string | null;
}

interface BusinessContextType {
  businesses: Business[];
  currentBusiness: Business | null;
  setCurrentBusiness: (b: Business) => void;
  isLoading: boolean;
  createBusiness: (name: string, type?: string) => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['businesses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('is_active', true)
        .order('created_at');
      if (error) throw error;
      return data as Business[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (businesses.length > 0 && !currentBusiness) {
      const saved = localStorage.getItem('currentBusinessId');
      const found = businesses.find(b => b.id === saved);
      setCurrentBusiness(found || businesses[0]);
    }
  }, [businesses, currentBusiness]);

  const handleSetBusiness = (b: Business) => {
    if (currentBusiness?.id === b.id) return;
    // Purge every cached query except the business list itself so nothing
    // from the previous tenant can render while the new one loads.
    queryClient.cancelQueries();
    queryClient.removeQueries({
      predicate: q => q.queryKey[0] !== 'businesses',
    });
    setCurrentBusiness(b);
    localStorage.setItem('currentBusinessId', b.id);
  };

  const createBusiness = async (name: string, type = 'retail') => {
    if (!user?.id) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('businesses')
      .insert({ name, type, created_by: user.id })
      .select()
      .single();
    if (error) throw error;

    // Add creator as owner
    await supabase.from('business_users').insert({
      business_id: data.id,
      user_id: user.id,
      role: 'owner',
      is_owner: true,
    });

    queryClient.invalidateQueries({ queryKey: ['businesses'] });
  };

  return (
    <BusinessContext.Provider value={{
      businesses,
      currentBusiness,
      setCurrentBusiness: handleSetBusiness,
      isLoading,
      createBusiness,
    }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (!context) throw new Error('useBusiness must be used within BusinessProvider');
  return context;
};
