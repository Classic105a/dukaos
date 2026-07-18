import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAuditLog } from './useAuditLog';
import { useToast } from './use-toast';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  credit_limit: number;
  credit_balance: number;
  credit_enabled: boolean;
}

interface CreditTransaction {
  id: string;
  customer_id: string;
  sale_id: string | null;
  transaction_type: 'CREDIT_SALE' | 'PAYMENT' | 'ADJUSTMENT' | 'REFUND';
  amount: number;
  running_balance: number;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  processed_by: string;
  created_at: string;
}

export const useCustomerCredit = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { log } = useAuditLog();
  const queryClient = useQueryClient();

  // Fetch customers with credit enabled
  const useCreditCustomers = () => {
    return useQuery({
      queryKey: ['credit-customers'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('credit_enabled', true)
          .order('name');
        if (error) throw error;
        return data as Customer[];
      },
    });
  };

  // Fetch credit history for a customer
  const useCreditHistory = (customerId: string) => {
    return useQuery({
      queryKey: ['credit-history', customerId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('credit_transactions')
          .select('*')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data as CreditTransaction[];
      },
      enabled: !!customerId,
    });
  };

  // Get credit aging report
  const useCreditAging = () => {
    return useQuery({
      queryKey: ['credit-aging'],
      queryFn: async () => {
        const { data: customers, error } = await supabase
          .from('customers')
          .select('*')
          .eq('credit_enabled', true)
          .gt('credit_balance', 0);
        
        if (error) throw error;

        // Get oldest unpaid transaction for each customer
        const agingData = await Promise.all(
          (customers || []).map(async (customer) => {
            const { data: transactions } = await supabase
              .from('credit_transactions')
              .select('created_at')
              .eq('customer_id', customer.id)
              .eq('transaction_type', 'CREDIT_SALE')
              .order('created_at', { ascending: true })
              .limit(1);

            const oldestDate = transactions?.[0]?.created_at;
            const daysSince = oldestDate
              ? Math.floor((Date.now() - new Date(oldestDate).getTime()) / (1000 * 60 * 60 * 24))
              : 0;

            let ageCategory: '0-7' | '8-14' | '15-30' | '30+' = '0-7';
            if (daysSince > 30) ageCategory = '30+';
            else if (daysSince > 14) ageCategory = '15-30';
            else if (daysSince > 7) ageCategory = '8-14';

            return {
              ...customer,
              oldestDebtDate: oldestDate,
              daysSinceOldest: daysSince,
              ageCategory,
            };
          })
        );

        return agingData;
      },
    });
  };

  // Record a credit sale
  const recordCreditSale = useMutation({
    mutationFn: async ({
      customerId,
      saleId,
      amount,
      notes,
    }: {
      customerId: string;
      saleId: string;
      amount: number;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get current balance
      const { data: customer } = await supabase
        .from('customers')
        .select('credit_balance, credit_limit, business_id')
        .eq('id', customerId)
        .single();

      if (!customer) throw new Error('Customer not found');

      const newBalance = Number(customer.credit_balance) + amount;
      
      if (newBalance > Number(customer.credit_limit)) {
        throw new Error(`Credit limit exceeded. Available: KES ${(Number(customer.credit_limit) - Number(customer.credit_balance)).toLocaleString()}`);
      }

      // Record transaction
      const { error: txError } = await supabase.from('credit_transactions').insert({
        customer_id: customerId,
        business_id: (customer as any).business_id,
        sale_id: saleId,
        transaction_type: 'CREDIT_SALE',
        amount: amount,
        running_balance: newBalance,
        notes,
        processed_by: user.id,
      } as any);

      if (txError) throw txError;

      // Update customer balance
      const { error: custError } = await supabase
        .from('customers')
        .update({ credit_balance: newBalance })
        .eq('id', customerId);

      if (custError) throw custError;

      return { customerId, amount, newBalance };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['credit-customers'] });
      queryClient.invalidateQueries({ queryKey: ['credit-history', result.customerId] });
      log('CREDIT_SALE', 'credit_transaction', result.customerId, undefined, { amount: result.amount, newBalance: result.newBalance });
      toast({ title: 'Credit sale recorded', description: `New balance: KES ${result.newBalance.toLocaleString()}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Credit sale failed', description: error.message, variant: 'destructive' });
    },
  });

  // Record a payment
  const recordPayment = useMutation({
    mutationFn: async ({
      customerId,
      amount,
      paymentMethod,
      reference,
      notes,
    }: {
      customerId: string;
      amount: number;
      paymentMethod: string;
      reference?: string;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get current balance
      const { data: customer } = await supabase
        .from('customers')
        .select('credit_balance, business_id')
        .eq('id', customerId)
        .single();

      if (!customer) throw new Error('Customer not found');

      const newBalance = Number(customer.credit_balance) - amount;

      // Record transaction
      const { error: txError } = await supabase.from('credit_transactions').insert({
        customer_id: customerId,
        business_id: (customer as any).business_id,
        transaction_type: 'PAYMENT',
        amount: -amount, // Negative for payment
        running_balance: newBalance,
        payment_method: paymentMethod,
        reference,
        notes,
        processed_by: user.id,
      } as any);

      if (txError) throw txError;

      // Update customer balance
      const { error: custError } = await supabase
        .from('customers')
        .update({ credit_balance: newBalance })
        .eq('id', customerId);

      if (custError) throw custError;

      return { customerId, amount, newBalance };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['credit-customers'] });
      queryClient.invalidateQueries({ queryKey: ['credit-history', result.customerId] });
      log('CREDIT_PAYMENT', 'credit_transaction', result.customerId, undefined, { amount: result.amount, newBalance: result.newBalance });
      toast({ title: 'Payment recorded', description: `New balance: KES ${result.newBalance.toLocaleString()}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Payment recording failed', description: error.message, variant: 'destructive' });
    },
  });

  // Enable credit for a customer
  const enableCredit = useMutation({
    mutationFn: async ({ customerId, creditLimit }: { customerId: string; creditLimit: number }) => {
      const { error } = await supabase
        .from('customers')
        .update({ credit_enabled: true, credit_limit: creditLimit })
        .eq('id', customerId);
      if (error) throw error;
      return { customerId, creditLimit };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Credit enabled for customer' });
    },
  });

  return {
    useCreditCustomers,
    useCreditHistory,
    useCreditAging,
    recordCreditSale,
    recordPayment,
    enableCredit,
  };
};
