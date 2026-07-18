import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface Party {
  id: string;
  business_id: string;
  name: string;
  party_type: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_balance: number;
  current_balance: number;
  pricing_tier: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export const useParties = (businessId?: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: parties = [], isLoading } = useQuery({
    queryKey: ['parties', businessId],
    queryFn: async () => {
      let query = supabase.from('parties').select('*').eq('is_active', true).order('name');
      if (businessId) query = query.eq('business_id', businessId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Party[];
    },
  });

  const createParty = useMutation({
    mutationFn: async (party: Partial<Party>) => {
      const { data, error } = await supabase.from('parties').insert(party as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      toast({ title: 'Party created successfully' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateParty = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Party> & { id: string }) => {
      const { error } = await supabase.from('parties').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      toast({ title: 'Party updated successfully' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const suppliers = parties.filter(p => p.party_type === 'supplier');
  const dealers = parties.filter(p => p.party_type === 'dealer');
  const wholesalers = parties.filter(p => p.party_type === 'wholesaler');
  const retailers = parties.filter(p => p.party_type === 'retailer');
  const banks = parties.filter(p => p.party_type === 'bank');

  const totalPayables = parties.reduce((sum, p) => sum + (p.current_balance || 0), 0);

  return {
    parties, suppliers, dealers, wholesalers, retailers, banks,
    totalPayables, isLoading,
    createParty, updateParty,
  };
};
