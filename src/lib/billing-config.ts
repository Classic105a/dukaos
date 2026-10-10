import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformBillingSettings {
  paybill_number: string | null;
  account_label: string;
  instructions: string | null;
}

const KEY = ['platform-billing-settings'];

/** Where businesses pay their DukaOS subscription — edited by platform admins. */
export const useBillingSettings = () =>
  useQuery({
    queryKey: KEY,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PlatformBillingSettings> => {
      const { data, error } = await (supabase as any)
        .from('platform_billing_settings')
        .select('paybill_number, account_label, instructions')
        .maybeSingle();
      if (error) throw error;
      return data ?? { paybill_number: null, account_label: 'Business name', instructions: null };
    },
  });

export const useSaveBillingSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: PlatformBillingSettings) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from('platform_billing_settings').upsert({
        id: true,
        paybill_number: s.paybill_number?.trim() || null,
        account_label: s.account_label.trim() || 'Business name',
        instructions: s.instructions?.trim() || null,
        updated_by: u.user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
