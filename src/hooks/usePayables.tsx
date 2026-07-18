import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface PayableTransaction {
  id: string;
  business_id: string;
  party_id: string;
  transaction_type: string;
  amount: number;
  running_balance: number;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  processed_by: string;
  created_at: string;
  parties?: { name: string; party_type: string };
}

export const usePayables = (partyId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['payable-transactions', partyId],
    queryFn: async () => {
      let query = supabase
        .from('payable_transactions')
        .select('*, parties:party_id(name, party_type)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (partyId) query = query.eq('party_id', partyId);
      const { data, error } = await query;
      if (error) throw error;
      return data as PayableTransaction[];
    },
  });

  const recordTransaction = useMutation({
    mutationFn: async (tx: {
      partyId: string;
      type: string;
      amount: number;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
      businessId?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get current party balance
      const { data: party } = await supabase
        .from('parties')
        .select('current_balance')
        .eq('id', tx.partyId)
        .single();

      const currentBalance = party?.current_balance || 0;
      const newBalance = tx.type === 'PAYMENT'
        ? currentBalance - tx.amount
        : currentBalance + tx.amount;

      // Insert transaction
      const { error: txError } = await supabase.from('payable_transactions').insert({
        party_id: tx.partyId,
        business_id: tx.businessId!,
        transaction_type: tx.type,
        amount: tx.amount,
        running_balance: newBalance,
        payment_method: tx.paymentMethod || null,
        reference: tx.reference || null,
        notes: tx.notes || null,
        processed_by: user.id,
      } as any);
      if (txError) throw txError;

      // Update party balance
      const { error: partyError } = await supabase
        .from('parties')
        .update({ current_balance: newBalance })
        .eq('id', tx.partyId);
      if (partyError) throw partyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payable-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      toast({ title: 'Transaction recorded' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return { transactions, isLoading, recordTransaction };
};
