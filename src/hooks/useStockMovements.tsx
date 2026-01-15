import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type MovementType = 'ADD' | 'SALE' | 'ADJUSTMENT' | 'RETURN' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'INITIAL';

interface StockMovementData {
  productId: string;
  branchId: string;
  quantityChange: number;
  movementType: MovementType;
  batchNumber?: string;
  expiryDate?: string;
  referenceId?: string;
  notes?: string;
}

export const useStockMovements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const recordMovement = useMutation({
    mutationFn: async (data: StockMovementData) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('stock_movements')
        .insert({
          product_id: data.productId,
          branch_id: data.branchId,
          quantity_change: data.quantityChange,
          movement_type: data.movementType,
          batch_number: data.batchNumber || null,
          expiry_date: data.expiryDate || null,
          reference_id: data.referenceId || null,
          notes: data.notes || null,
          created_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['current-stock'] });
    },
  });

  const addStock = async (
    productId: string,
    branchId: string,
    quantity: number,
    batchNumber?: string,
    expiryDate?: string,
    notes?: string
  ) => {
    return recordMovement.mutateAsync({
      productId,
      branchId,
      quantityChange: quantity,
      movementType: 'ADD',
      batchNumber,
      expiryDate,
      notes,
    });
  };

  const adjustStock = async (
    productId: string,
    branchId: string,
    currentStock: number,
    newStock: number,
    notes?: string
  ) => {
    const difference = newStock - currentStock;
    return recordMovement.mutateAsync({
      productId,
      branchId,
      quantityChange: difference,
      movementType: 'ADJUSTMENT',
      notes: notes || `Stock adjusted from ${currentStock} to ${newStock}`,
    });
  };

  const recordSale = async (
    productId: string,
    branchId: string,
    quantity: number,
    saleId: string
  ) => {
    return recordMovement.mutateAsync({
      productId,
      branchId,
      quantityChange: -quantity,
      movementType: 'SALE',
      referenceId: saleId,
    });
  };

  const recordReturn = async (
    productId: string,
    branchId: string,
    quantity: number,
    returnId: string
  ) => {
    return recordMovement.mutateAsync({
      productId,
      branchId,
      quantityChange: quantity,
      movementType: 'RETURN',
      referenceId: returnId,
    });
  };

  return {
    recordMovement,
    addStock,
    adjustStock,
    recordSale,
    recordReturn,
    isLoading: recordMovement.isPending,
  };
};
