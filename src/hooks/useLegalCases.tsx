import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface LegalCase {
  id: string;
  business_id: string | null;
  customer_id: string | null;
  party_id: string | null;
  case_number: string | null;
  court_name: string;
  amount_claimed: number;
  filing_date: string | null;
  next_hearing_date: string | null;
  status: string;
  outcome: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  customers?: { name: string; phone: string | null };
  parties?: { name: string; party_type: string };
}

export const useLegalCases = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['legal-cases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('legal_cases')
        .select('*, customers:customer_id(name, phone), parties:party_id(name, party_type)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LegalCase[];
    },
  });

  const createCase = useMutation({
    mutationFn: async (caseData: Partial<LegalCase>) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('legal_cases')
        .insert({ ...caseData, created_by: user.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-cases'] });
      toast({ title: 'Legal case created' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateCase = useMutation({
    mutationFn: async ({ id, ...data }: Partial<LegalCase> & { id: string }) => {
      const { error } = await supabase.from('legal_cases').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-cases'] });
      toast({ title: 'Case updated' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const activeCases = cases.filter(c => !['settled', 'closed'].includes(c.status));
  const totalClaimed = activeCases.reduce((sum, c) => sum + c.amount_claimed, 0);

  return { cases, activeCases, totalClaimed, isLoading, createCase, updateCase };
};
