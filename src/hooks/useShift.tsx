import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBranch } from './useBranch';
import { useToast } from './use-toast';

interface Shift {
  id: string;
  branch_id: string;
  cashier_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  expected_cash: number | null;
  actual_cash: number | null;
  cash_discrepancy: number | null;
  status: 'open' | 'closed' | 'locked';
  notes: string | null;
}

interface ShiftSummary {
  totalSales: number;
  cashSales: number;
  mpesaSales: number;
  cardSales: number;
  transactionCount: number;
  refundsTotal: number;
}

interface CloseShiftResult {
  expectedCash: number;
  actualCash: number;
  discrepancy: number;
}

interface ShiftContextType {
  currentShift: Shift | null;
  isLoading: boolean;
  hasOpenShift: boolean;
  openShift: (openingFloat: number) => Promise<Shift>;
  closeShift: (actualCash: number, notes?: string) => Promise<CloseShiftResult>;
  getShiftSummary: () => Promise<ShiftSummary>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export const ShiftProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current open shift
  const { data: currentShift, isLoading } = useQuery({
    queryKey: ['current-shift', user?.id, currentBranch?.id],
    queryFn: async () => {
      if (!user?.id || !currentBranch?.id) return null;

      const { data, error } = await supabase
        .from('cashier_shifts')
        .select('*')
        .eq('cashier_id', user.id)
        .eq('branch_id', currentBranch.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as Shift | null;
    },
    enabled: !!user?.id && !!currentBranch?.id,
  });

  const openShiftMutation = useMutation({
    mutationFn: async (openingFloat: number) => {
      if (!user?.id || !currentBranch?.id) throw new Error('Not authenticated or no branch selected');

      // Check for existing open shift
      if (currentShift) {
        throw new Error('You already have an open shift. Please close it first.');
      }

      const { data, error } = await supabase
        .from('cashier_shifts')
        .insert({
          branch_id: currentBranch.id,
          cashier_id: user.id,
          opening_float: openingFloat,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-shift'] });
      toast({ title: 'Shift opened successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to open shift', description: error.message, variant: 'destructive' });
    },
  });

  const closeShiftMutation = useMutation({
    mutationFn: async ({ actualCash, notes }: { actualCash: number; notes?: string }) => {
      if (!currentShift) throw new Error('No open shift to close');

      // Calculate expected cash
      const summary = await getShiftSummary();
      const expectedCash = currentShift.opening_float + summary.cashSales - summary.refundsTotal;
      const discrepancy = actualCash - expectedCash;

      const { error } = await supabase
        .from('cashier_shifts')
        .update({
          closed_at: new Date().toISOString(),
          expected_cash: expectedCash,
          actual_cash: actualCash,
          cash_discrepancy: discrepancy,
          status: 'closed',
          notes,
          closed_by: user?.id,
        })
        .eq('id', currentShift.id);

      if (error) throw error;

      return { expectedCash, actualCash, discrepancy };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['current-shift'] });
      
      if (result.discrepancy !== 0) {
        toast({
          title: 'Shift closed with discrepancy',
          description: `Expected: KES ${result.expectedCash.toLocaleString()}, Actual: KES ${result.actualCash.toLocaleString()}, Difference: KES ${result.discrepancy.toLocaleString()}`,
          variant: result.discrepancy < 0 ? 'destructive' : 'default',
        });
      } else {
        toast({ title: 'Shift closed successfully - cash balanced!' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to close shift', description: error.message, variant: 'destructive' });
    },
  });

  const getShiftSummary = async () => {
    if (!currentShift) {
      return { totalSales: 0, cashSales: 0, mpesaSales: 0, cardSales: 0, transactionCount: 0, refundsTotal: 0 };
    }

    // Get sales for this shift
    const { data: sales } = await supabase
      .from('sales')
      .select('id, total_amount')
      .eq('shift_id', currentShift.id)
      .eq('payment_status', 'completed');

    const saleIds = sales?.map(s => s.id) || [];
    
    // Get payments breakdown
    const { data: payments } = await supabase
      .from('payments')
      .select('payment_method, amount')
      .in('sale_id', saleIds.length > 0 ? saleIds : ['00000000-0000-0000-0000-000000000000']);

    const cashSales = payments?.filter(p => p.payment_method === 'cash').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const mpesaSales = payments?.filter(p => p.payment_method === 'mpesa').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const cardSales = payments?.filter(p => p.payment_method === 'card').reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // Get refunds (approximate - check returns table)
    const { data: refunds } = await supabase
      .from('returns')
      .select('refund_amount')
      .eq('processed_by', currentShift.cashier_id)
      .gte('created_at', currentShift.opened_at);

    const refundsTotal = refunds?.reduce((sum, r) => sum + Number(r.refund_amount), 0) || 0;

    return {
      totalSales: sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0,
      cashSales,
      mpesaSales,
      cardSales,
      transactionCount: sales?.length || 0,
      refundsTotal,
    };
  };

  return (
    <ShiftContext.Provider
      value={{
        currentShift: currentShift ?? null,
        isLoading,
        hasOpenShift: !!currentShift,
        openShift: (float) => openShiftMutation.mutateAsync(float),
        closeShift: (actual, notes) => closeShiftMutation.mutateAsync({ actualCash: actual, notes }),
        getShiftSummary,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
};

export const useShift = () => {
  const context = useContext(ShiftContext);
  if (context === undefined) {
    throw new Error('useShift must be used within a ShiftProvider');
  }
  return context;
};
