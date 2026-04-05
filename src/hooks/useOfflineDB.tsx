import { useState, useEffect, useCallback } from 'react';
import { useBranch } from '@/hooks/useBranch';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import {
  getLocalProducts,
  getLocalStock,
  getLocalCategories,
  getLocalCustomers,
  type LocalCategory,
  type LocalCustomer,
} from '@/lib/offline-db';

export interface OfflineProduct {
  id: string;
  name: string;
  barcode: string | null;
  unit_price: number;
  image_url: string | null;
  category_id: string | null;
  category?: { name: string; color: string } | null;
  stock: number;
  is_shared_product: boolean;
}

/**
 * Hook providing offline-capable access to products, categories, and customers.
 * Caches server data into IndexedDB and falls back to local data when offline.
 */
export const useOfflineDB = () => {
  const { currentBranch } = useBranch();
  const { isOnline, cacheServerData } = useOfflineSync();

  const [products, setProducts] = useState<OfflineProduct[]>([]);
  const [categories, setCategories] = useState<LocalCategory[]>([]);
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'server' | 'cache'>('server');

  const loadFromCache = useCallback(async (branchId: string) => {
    try {
      const [localProducts, stockMap, localCategories, localCustomers] = await Promise.all([
        getLocalProducts(branchId),
        getLocalStock(branchId),
        getLocalCategories(),
        getLocalCustomers(),
      ]);

      const productsWithStock: OfflineProduct[] = localProducts.map(p => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        unit_price: p.unit_price,
        image_url: p.image_url,
        category_id: p.category_id,
        category: p.category_name ? { name: p.category_name, color: p.category_color || '#10B981' } : null,
        stock: stockMap.get(p.id) ?? 0,
        is_shared_product: p.is_shared_product,
      }));

      setProducts(productsWithStock);
      setCategories(localCategories);
      setCustomers(localCustomers);
      setDataSource('cache');
      return productsWithStock.length > 0;
    } catch {
      return false;
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!currentBranch?.id) return;
    setLoading(true);

    try {
      if (isOnline) {
        // Cache server data first, then load from cache
        await cacheServerData(currentBranch.id);
        await loadFromCache(currentBranch.id);
        setDataSource('server');
      } else {
        // Offline: load from cache only
        const hasCachedData = await loadFromCache(currentBranch.id);
        if (!hasCachedData) {
          console.warn('[OfflineDB] No cached data available for offline use');
        }
        setDataSource('cache');
      }
    } catch (error) {
      console.error('[OfflineDB] Error loading data:', error);
      // Fallback to cache
      await loadFromCache(currentBranch.id);
      setDataSource('cache');
    } finally {
      setLoading(false);
    }
  }, [currentBranch?.id, isOnline, cacheServerData, loadFromCache]);

  // Load data on mount and branch change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh from cache when products might have changed (after local sale)
  const refreshLocalData = useCallback(async () => {
    if (currentBranch?.id) {
      await loadFromCache(currentBranch.id);
    }
  }, [currentBranch?.id, loadFromCache]);

  return {
    products,
    categories,
    customers,
    loading,
    dataSource,
    refreshLocalData,
    reloadData: loadData,
  };
};
