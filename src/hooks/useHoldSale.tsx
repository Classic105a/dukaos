import { useState, useEffect, useCallback } from 'react';
import type { CartItem } from '@/components/pos/Cart';

export interface HeldSale {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerName?: string;
  createdAt: Date;
}

const STORAGE_KEY = 'dukaos_held_sales';

export const useHoldSale = () => {
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);

  // Load held sales from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        const sales = parsed.map((sale: HeldSale) => ({
          ...sale,
          createdAt: new Date(sale.createdAt)
        }));
        setHeldSales(sales);
      }
    } catch (error) {
      console.error('Failed to load held sales:', error);
    }
  }, []);

  // Save to localStorage whenever heldSales changes
  const saveToStorage = useCallback((sales: HeldSale[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
    } catch (error) {
      console.error('Failed to save held sales:', error);
    }
  }, []);

  const holdSale = useCallback((
    items: CartItem[],
    subtotal: number,
    tax: number,
    discount: number,
    total: number,
    customerName?: string
  ): string => {
    const newSale: HeldSale = {
      id: `hold_${Date.now()}`,
      items,
      subtotal,
      tax,
      discount,
      total,
      customerName,
      createdAt: new Date()
    };

    setHeldSales(prev => {
      const updated = [...prev, newSale];
      saveToStorage(updated);
      return updated;
    });

    return newSale.id;
  }, [saveToStorage]);

  const resumeSale = useCallback((saleId: string): HeldSale | null => {
    const sale = heldSales.find(s => s.id === saleId);
    if (sale) {
      setHeldSales(prev => {
        const updated = prev.filter(s => s.id !== saleId);
        saveToStorage(updated);
        return updated;
      });
      return sale;
    }
    return null;
  }, [heldSales, saveToStorage]);

  const deleteHeldSale = useCallback((saleId: string) => {
    setHeldSales(prev => {
      const updated = prev.filter(s => s.id !== saleId);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const clearAllHeldSales = useCallback(() => {
    setHeldSales([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    heldSales,
    heldSalesCount: heldSales.length,
    holdSale,
    resumeSale,
    deleteHeldSale,
    clearAllHeldSales
  };
};
