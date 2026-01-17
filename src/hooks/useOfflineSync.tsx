import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  retryCount?: number;
  lastError?: string;
}

const MAX_RETRY_COUNT = 3;
const STORAGE_KEY = 'pendingSales';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSales, setPendingSales] = useState<OfflineSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Load pending sales from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate structure
        if (Array.isArray(parsed)) {
          setPendingSales(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading pending sales:', error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncError(null);
      toast.success('Back online! Syncing data...');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Sales will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingSales.length > 0 && !isSyncing) {
      syncPendingSales();
    }
  }, [isOnline]);

  const saveToStorage = useCallback((sales: OfflineSale[]) => {
    try {
      // Check localStorage capacity (typically 5MB)
      const serialized = JSON.stringify(sales);
      if (serialized.length > 4 * 1024 * 1024) { // 4MB limit for safety
        toast.error('Local storage nearly full. Please sync your sales.');
        return false;
      }
      localStorage.setItem(STORAGE_KEY, serialized);
      return true;
    } catch (error) {
      console.error('Error saving to storage:', error);
      toast.error('Failed to save offline. Storage may be full.');
      return false;
    }
  }, []);

  const saveSaleOffline = useCallback((sale: Omit<OfflineSale, 'id'>) => {
    const newSale: OfflineSale = {
      ...sale,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      retryCount: 0,
    };

    const updated = [...pendingSales, newSale];
    if (saveToStorage(updated)) {
      setPendingSales(updated);
      return newSale;
    }
    return null;
  }, [pendingSales, saveToStorage]);

  const syncPendingSales = useCallback(async () => {
    if (isSyncing || pendingSales.length === 0 || !isOnline) return;

    setIsSyncing(true);
    setSyncError(null);
    const synced: string[] = [];
    const failed: OfflineSale[] = [];

    for (const sale of pendingSales) {
      // Skip sales that have exceeded retry limit
      if ((sale.retryCount || 0) >= MAX_RETRY_COUNT) {
        failed.push({ ...sale, lastError: 'Max retries exceeded' });
        continue;
      }

      try {
        // Check if already synced (conflict resolution)
        const { data: existingSale } = await supabase
          .from('sales')
          .select('id')
          .eq('offline_id', sale.id)
          .maybeSingle();

        if (existingSale) {
          // Already synced, mark as done
          synced.push(sale.id);
          continue;
        }

        // Generate receipt number
        const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}`;

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          failed.push({ ...sale, lastError: 'Not authenticated', retryCount: (sale.retryCount || 0) + 1 });
          continue;
        }

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

        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert(
            sale.items.map(item => ({
              product_id: item.product_id,
              branch_id: sale.branch_id,
              quantity_change: -item.quantity,
              movement_type: 'SALE',
              reference_id: saleData.id,
              created_by: user.id,
              notes: `Offline sale sync ${receiptNumber}`,
            }))
          );

        if (movementError) throw movementError;

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
      } catch (error: any) {
        console.error('Error syncing sale:', sale.id, error);
        failed.push({
          ...sale,
          lastError: error.message || 'Unknown error',
          retryCount: (sale.retryCount || 0) + 1
        });
      }
    }

    // Update state with results
    const remaining = failed.filter(s => (s.retryCount || 0) < MAX_RETRY_COUNT);
    const permanentlyFailed = failed.filter(s => (s.retryCount || 0) >= MAX_RETRY_COUNT);

    setPendingSales(remaining);
    saveToStorage(remaining);
    
    setIsSyncing(false);

    // Show results
    if (synced.length > 0) {
      toast.success(`Synced ${synced.length} sale${synced.length > 1 ? 's' : ''}`);
    }
    if (permanentlyFailed.length > 0) {
      setSyncError(`${permanentlyFailed.length} sale(s) failed to sync after ${MAX_RETRY_COUNT} attempts`);
      toast.error(`${permanentlyFailed.length} sale(s) failed to sync. Contact support.`);
    }
    if (remaining.length > 0 && remaining.length !== pendingSales.length) {
      toast.warning(`${remaining.length} sale(s) pending retry`);
    }
  }, [pendingSales, isSyncing, isOnline, saveToStorage]);

  const clearFailedSales = useCallback(() => {
    const remaining = pendingSales.filter(s => (s.retryCount || 0) < MAX_RETRY_COUNT);
    setPendingSales(remaining);
    saveToStorage(remaining);
    setSyncError(null);
  }, [pendingSales, saveToStorage]);

  return {
    isOnline,
    pendingSales,
    pendingCount: pendingSales.length,
    isSyncing,
    syncError,
    saveSaleOffline,
    syncPendingSales,
    clearFailedSales,
  };
};
