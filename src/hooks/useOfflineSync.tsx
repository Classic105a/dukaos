import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  cacheProducts,
  cacheStock,
  cacheCustomers,
  cacheCategories,
  saveLocalTransaction,
  getUnsyncedTransactions,
  markTransactionSynced,
  addToSyncQueue,
  getPendingSyncItems,
  updateSyncQueueItem,
  deductLocalStock,
  cleanupSyncQueue,
  getSyncQueueStats,
  type LocalProduct,
  type LocalStock,
  type LocalTransaction,
  type SyncQueueItem,
} from '@/lib/offline-db';

const SYNC_INTERVAL = 30_000; // 30 seconds
const DATA_CACHE_INTERVAL = 5 * 60_000; // 5 minutes

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastCacheTime, setLastCacheTime] = useState(0);
  const syncLockRef = useRef(false);
  const mountedRef = useRef(true);

  // ─── Online/Offline monitoring ───────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
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
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ─── Update pending count ───────────────────────────────────────
  const refreshPendingCount = useCallback(async () => {
    try {
      const unsynced = await getUnsyncedTransactions();
      const queueStats = await getSyncQueueStats();
      if (mountedRef.current) {
        setPendingCount(unsynced.length + queueStats.pending + queueStats.retryable);
      }
    } catch {
      // IndexedDB might not be ready yet
    }
  }, []);

  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 5000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  // ─── Cache server data into IndexedDB ────────────────────────────
  const cacheServerData = useCallback(async (branchId: string) => {
    if (!navigator.onLine) return;

    try {
      // Fetch and cache products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, barcode, unit_price, cost_price, image_url, category_id, branch_id, is_shared_product, is_active, tax_rate, sku, unit_of_measure, track_inventory, low_stock_threshold, categories(name, color)')
        .eq('is_active', true)
        .or(`branch_id.eq.${branchId},is_shared_product.eq.true`);

      if (productsData) {
        const localProducts: LocalProduct[] = productsData.map((p: any) => ({
          id: p.id,
          name: p.name,
          barcode: p.barcode,
          unit_price: p.unit_price,
          cost_price: p.cost_price,
          image_url: p.image_url,
          category_id: p.category_id,
          category_name: p.categories?.name || null,
          category_color: p.categories?.color || null,
          branch_id: p.branch_id,
          is_shared_product: p.is_shared_product,
          is_active: p.is_active,
          tax_rate: p.tax_rate,
          sku: p.sku,
          unit_of_measure: p.unit_of_measure,
          track_inventory: p.track_inventory ?? true,
          low_stock_threshold: p.low_stock_threshold,
          _synced_at: Date.now(),
        }));
        await cacheProducts(localProducts);
      }

      // Fetch and cache stock levels
      const { data: stockData } = await supabase
        .from('current_stock')
        .select('product_id, quantity')
        .eq('branch_id', branchId);

      if (stockData) {
        const localStock: LocalStock[] = stockData.map(s => ({
          id: `${s.product_id}_${branchId}`,
          product_id: s.product_id!,
          branch_id: branchId,
          quantity: s.quantity ?? 0,
          _synced_at: Date.now(),
        }));
        await cacheStock(localStock);
      }

      // Fetch and cache categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name, color, is_active')
        .eq('is_active', true);

      if (categoriesData) {
        await cacheCategories(categoriesData.map(c => ({ ...c, _synced_at: Date.now() })));
      }

      // Fetch and cache customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name, phone, email, credit_enabled, credit_limit, credit_balance, segment');

      if (customersData) {
        await cacheCustomers(customersData.map(c => ({
          ...c,
          credit_enabled: c.credit_enabled ?? false,
          credit_limit: c.credit_limit ?? 0,
          credit_balance: c.credit_balance ?? 0,
          _synced_at: Date.now(),
        })));
      }

      setLastCacheTime(Date.now());
      console.log('[OfflineSync] Server data cached to IndexedDB');
    } catch (error) {
      console.error('[OfflineSync] Failed to cache server data:', error);
    }
  }, []);

  // ─── Save sale offline (local-first) ─────────────────────────────
  const saveSaleOffline = useCallback(async (sale: Omit<LocalTransaction, 'id' | 'is_synced' | 'server_id' | 'synced_at'>) => {
    const localId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const tx: LocalTransaction = {
      ...sale,
      id: localId,
      is_synced: false,
      server_id: null,
      synced_at: null,
    };

    await saveLocalTransaction(tx);

    // Deduct local stock immediately
    await deductLocalStock(sale.branch_id, sale.items.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
    })));

    // Add to sync queue
    await addToSyncQueue({
      entity_type: 'sale',
      entity_id: localId,
      payload: tx,
      status: 'pending',
      retry_count: 0,
      max_retries: 10,
      error_message: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      synced_at: null,
      branch_id: sale.branch_id,
      user_id: sale.cashier_id,
    });

    await refreshPendingCount();
    return tx;
  }, [refreshPendingCount]);

  // ─── Sync a single sale to server ────────────────────────────────
  const syncSaleToServer = useCallback(async (queueItem: SyncQueueItem): Promise<boolean> => {
    const sale = queueItem.payload as LocalTransaction;

    try {
      // Conflict check: already synced?
      const { data: existing } = await supabase
        .from('sales')
        .select('id')
        .eq('offline_id', sale.id)
        .maybeSingle();

      if (existing) {
        await markTransactionSynced(sale.id, existing.id);
        return true;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert sale
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          branch_id: sale.branch_id,
          cashier_id: user.id,
          customer_id: sale.customer_id || null,
          receipt_number: sale.receipt_number,
          subtotal: sale.subtotal,
          tax_amount: sale.tax_amount,
          discount_amount: sale.discount_amount,
          total_amount: sale.total_amount,
          payment_status: 'completed',
          is_synced: true,
          offline_id: sale.id,
          shift_id: sale.shift_id || null,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Insert sale items
      await supabase.from('sale_items').insert(
        sale.items.map(item => ({
          sale_id: saleData.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.total_amount,
        }))
      );

      // Insert stock movements
      await supabase.from('stock_movements').insert(
        sale.items.map(item => ({
          product_id: item.product_id,
          branch_id: sale.branch_id,
          quantity_change: -item.quantity,
          movement_type: 'SALE',
          reference_id: saleData.id,
          created_by: user.id,
          notes: `Offline sale sync ${sale.receipt_number}`,
        }))
      );

      // Insert payments
      await supabase.from('payments').insert(
        sale.payments.map(p => ({
          sale_id: saleData.id,
          payment_method: p.payment_method,
          amount: p.amount,
          mpesa_reference: p.mpesa_reference || null,
          mpesa_phone: p.mpesa_phone || null,
          status: 'completed',
        }))
      );

      // Handle credit payments
      const creditPayment = sale.payments.find(p => p.payment_method === 'credit');
      if (creditPayment?.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('credit_balance')
          .eq('id', creditPayment.customer_id)
          .single();

        const newBalance = (customerData?.credit_balance || 0) + sale.total_amount;

        await supabase.from('credit_transactions').insert({
          customer_id: creditPayment.customer_id,
          sale_id: saleData.id,
          transaction_type: 'CREDIT_SALE',
          amount: sale.total_amount,
          running_balance: newBalance,
          processed_by: user.id,
          notes: `Offline sale sync ${sale.receipt_number}`,
        });

        await supabase
          .from('customers')
          .update({ credit_balance: newBalance })
          .eq('id', creditPayment.customer_id);
      }

      await markTransactionSynced(sale.id, saleData.id);
      return true;
    } catch (error: any) {
      console.error('[OfflineSync] Failed to sync sale:', sale.id, error);
      throw error;
    }
  }, []);

  // ─── Background sync engine ──────────────────────────────────────
  const syncPendingSales = useCallback(async () => {
    if (syncLockRef.current || !navigator.onLine) return;
    syncLockRef.current = true;
    setIsSyncing(true);
    setSyncError(null);

    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pendingItems = await getPendingSyncItems();

      for (const item of pendingItems) {
        if (!navigator.onLine) break;

        try {
          await updateSyncQueueItem(item.id!, { status: 'syncing' });

          if (item.entity_type === 'sale') {
            const success = await syncSaleToServer(item);
            if (success) {
              await updateSyncQueueItem(item.id!, { status: 'synced', synced_at: Date.now() });
              syncedCount++;
            }
          }
        } catch (error: any) {
          const newRetry = item.retry_count + 1;
          await updateSyncQueueItem(item.id!, {
            status: newRetry >= item.max_retries ? 'failed' : 'pending',
            retry_count: newRetry,
            error_message: error.message || 'Unknown error',
          });
          failedCount++;
        }
      }

      if (syncedCount > 0) {
        toast.success(`Synced ${syncedCount} transaction${syncedCount > 1 ? 's' : ''}`);
      }
      if (failedCount > 0) {
        const stats = await getSyncQueueStats();
        if (stats.failed > 0) {
          setSyncError(`${stats.failed} transaction(s) failed permanently`);
        }
      }

      // Cleanup old synced items
      await cleanupSyncQueue();
    } catch (error) {
      console.error('[OfflineSync] Sync engine error:', error);
    } finally {
      syncLockRef.current = false;
      if (mountedRef.current) {
        setIsSyncing(false);
        await refreshPendingCount();
      }
    }
  }, [syncSaleToServer, refreshPendingCount]);

  // ─── Auto-sync interval ─────────────────────────────────────────
  useEffect(() => {
    if (!isOnline) return;

    // Sync immediately when coming online
    syncPendingSales();

    const interval = setInterval(() => {
      if (navigator.onLine) syncPendingSales();
    }, SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [isOnline, syncPendingSales]);

  // ─── Clear permanently failed items ─────────────────────────────
  const clearFailedSales = useCallback(async () => {
    const items = await offlineDB.syncQueue
      .where('status')
      .equals('failed')
      .toArray();

    for (const item of items) {
      if (item.retry_count >= item.max_retries) {
        await offlineDB.syncQueue.delete(item.id!);
      }
    }
    setSyncError(null);
    await refreshPendingCount();
  }, [refreshPendingCount]);

  return {
    isOnline,
    isSyncing,
    syncError,
    pendingCount,
    lastCacheTime,
    saveSaleOffline,
    syncPendingSales,
    clearFailedSales,
    cacheServerData,
    refreshPendingCount,
  };
};
