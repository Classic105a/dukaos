import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

const RECOVERY_KEY = 'pos_transaction_recovery';

interface TransactionCheckpoint {
  id: string;
  stage: 'cart' | 'payment_started' | 'sale_created' | 'items_inserted' | 'stock_deducted' | 'completed';
  cartItems: any[];
  saleId?: string;
  timestamp: number;
  branchId: string;
  cashierId: string;
}

/**
 * Provides transaction recovery capabilities for the POS.
 * Saves checkpoints at each stage of the checkout flow so
 * incomplete transactions can be detected and recovered.
 */
export const useTransactionRecovery = () => {
  const checkpointRef = useRef<TransactionCheckpoint | null>(null);

  // Check for incomplete transactions on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECOVERY_KEY);
      if (stored) {
        const checkpoint: TransactionCheckpoint = JSON.parse(stored);
        const ageMinutes = (Date.now() - checkpoint.timestamp) / 60000;

        // Only recover transactions less than 30 minutes old
        if (ageMinutes < 30 && checkpoint.stage !== 'completed') {
          checkpointRef.current = checkpoint;
          toast.warning(
            `Incomplete transaction detected (${checkpoint.cartItems.length} items). Recovery available.`,
            {
              duration: 10000,
              action: {
                label: 'Dismiss',
                onClick: () => clearCheckpoint(),
              },
            }
          );
        } else {
          localStorage.removeItem(RECOVERY_KEY);
        }
      }
    } catch {
      localStorage.removeItem(RECOVERY_KEY);
    }
  }, []);

  const saveCheckpoint = useCallback((checkpoint: Omit<TransactionCheckpoint, 'timestamp'>) => {
    const data: TransactionCheckpoint = {
      ...checkpoint,
      timestamp: Date.now(),
    };
    checkpointRef.current = data;
    try {
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save transaction checkpoint:', e);
    }
  }, []);

  const clearCheckpoint = useCallback(() => {
    checkpointRef.current = null;
    localStorage.removeItem(RECOVERY_KEY);
  }, []);

  const getRecoverableTransaction = useCallback((): TransactionCheckpoint | null => {
    return checkpointRef.current;
  }, []);

  return {
    saveCheckpoint,
    clearCheckpoint,
    getRecoverableTransaction,
    hasRecoverable: checkpointRef.current !== null && checkpointRef.current.stage !== 'completed',
  };
};
