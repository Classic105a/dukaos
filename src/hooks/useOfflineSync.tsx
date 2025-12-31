import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OfflineSale {
  id: string;
  branch_id: string;
  customer_id?: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_amount: number;
  }>;
  payments: Array<{
    payment_method: string;
    amount: number;
    mpesa_reference?: string;
    mpesa_phone?: string;
  }>;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  created_at: string;
}

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSales, setPendingSales] = useState<OfflineSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load pending sales from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('pendingSales');
    if (stored) {
      setPendingSales(JSON.parse(stored));
    }
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingSales.length > 0) {
      syncPendingSales();
    }
  }, [isOnline]);

  const saveSaleOffline = useCallback((sale: Omit<OfflineSale, 'id'>) => {
    const newSale: OfflineSale = {
      ...sale,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const updated = [...pendingSales, newSale];
    setPendingSales(updated);
    localStorage.setItem('pendingSales', JSON.stringify(updated));
    
    return newSale;
  }, [pendingSales]);

  const syncPendingSales = useCallback(async () => {
    if (isSyncing || pendingSales.length === 0) return;

    setIsSyncing(true);
    const synced: string[] = [];

    for (const sale of pendingSales) {
      try {
        // Generate receipt number
        const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}`;

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) continue;

        // Create sale record
        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert({
            branch_id: sale.branch_id,
            customer_id: sale.customer_id || null,
            cashier_id: user.id,
            receipt_number: receiptNumber,
            subtotal: sale.subtotal,
            tax_amount: sale.tax_amount,
            discount_amount: sale.discount_amount,
            total_amount: sale.total_amount,
            payment_status: 'completed',
            is_synced: true,
            offline_id: sale.id
          })
          .select()
          .single();

        if (saleError) throw saleError;

        // Create sale items
        const itemsToInsert = sale.items.map(item => ({
          sale_id: saleData.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.total_amount
        }));

        await supabase.from('sale_items').insert(itemsToInsert);

        // Deduct stock for each item
        for (const item of sale.items) {
          const { data: inventory } = await supabase
            .from('branch_inventory')
            .select('id, quantity')
            .eq('branch_id', sale.branch_id)
            .eq('product_id', item.product_id)
            .maybeSingle();

          if (inventory) {
            await supabase
              .from('branch_inventory')
              .update({ quantity: Math.max(0, inventory.quantity - item.quantity) })
              .eq('id', inventory.id);
          }
        }

        // Create payments
        const paymentsToInsert = sale.payments.map(payment => ({
          sale_id: saleData.id,
          payment_method: payment.payment_method,
          amount: payment.amount,
          mpesa_reference: payment.mpesa_reference || null,
          mpesa_phone: payment.mpesa_phone || null,
          status: 'completed'
        }));

        await supabase.from('payments').insert(paymentsToInsert);

        synced.push(sale.id);
      } catch (error) {
        console.error('Error syncing sale:', sale.id, error);
      }
    }

    // Remove synced sales
    const remaining = pendingSales.filter(s => !synced.includes(s.id));
    setPendingSales(remaining);
    localStorage.setItem('pendingSales', JSON.stringify(remaining));
    
    setIsSyncing(false);
  }, [pendingSales, isSyncing]);

  return {
    isOnline,
    pendingSales,
    pendingCount: pendingSales.length,
    isSyncing,
    saveSaleOffline,
    syncPendingSales
  };
};
