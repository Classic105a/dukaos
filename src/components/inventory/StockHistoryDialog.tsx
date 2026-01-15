import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  RefreshCw, 
  RotateCcw,
  ArrowRightLeft,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StockHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  branchId: string;
  branchName: string;
}

interface StockMovement {
  id: string;
  quantity_change: number;
  movement_type: string;
  batch_number: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

const movementConfig: Record<string, { icon: typeof ArrowUpCircle; color: string; label: string }> = {
  ADD: { icon: ArrowUpCircle, color: 'text-green-500', label: 'Stock Added' },
  SALE: { icon: ArrowDownCircle, color: 'text-red-500', label: 'Sale' },
  ADJUSTMENT: { icon: RefreshCw, color: 'text-blue-500', label: 'Adjustment' },
  RETURN: { icon: RotateCcw, color: 'text-orange-500', label: 'Return' },
  TRANSFER_IN: { icon: ArrowRightLeft, color: 'text-purple-500', label: 'Transfer In' },
  TRANSFER_OUT: { icon: ArrowRightLeft, color: 'text-yellow-500', label: 'Transfer Out' },
  INITIAL: { icon: Package, color: 'text-gray-500', label: 'Initial Stock' },
};

const StockHistoryDialog = ({
  isOpen,
  onClose,
  productId,
  productName,
  branchId,
  branchName,
}: StockHistoryDialogProps) => {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['stock-movements', productId, branchId],
    queryFn: async () => {
      // First fetch movements
      const { data: movementsData, error: movementsError } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (movementsError) throw movementsError;
      
      // Then fetch profiles for users who created movements
      const userIds = [...new Set((movementsData || []).map(m => m.created_by).filter(Boolean))];
      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        profilesMap = (profilesData || []).reduce((acc, p) => {
          acc[p.id] = { full_name: p.full_name, email: p.email };
          return acc;
        }, {} as Record<string, { full_name: string | null; email: string | null }>);
      }
      
      return (movementsData || []).map(m => ({
        ...m,
        profiles: m.created_by ? profilesMap[m.created_by] || null : null,
      })) as StockMovement[];
    },
    enabled: isOpen && !!productId && !!branchId,
  });

  // Calculate running balance
  const movementsWithBalance = movements.map((movement, index) => {
    const subsequentSum = movements
      .slice(0, index + 1)
      .reduce((sum, m) => sum + m.quantity_change, 0);
    return { ...movement, runningBalance: subsequentSum };
  }).reverse();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Stock History - {productName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Branch: {branchName}
          </p>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Package className="w-12 h-12 mb-2 opacity-50" />
              <p>No stock movements recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {movementsWithBalance.reverse().map((movement) => {
                const config = movementConfig[movement.movement_type] || movementConfig.ADJUSTMENT;
                const Icon = config.icon;
                const isPositive = movement.quantity_change > 0;

                return (
                  <div
                    key={movement.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn('mt-0.5', config.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {config.label}
                        </Badge>
                        <span
                          className={cn(
                            'font-semibold text-sm',
                            isPositive ? 'text-green-600' : 'text-red-600'
                          )}
                        >
                          {isPositive ? '+' : ''}{movement.quantity_change}
                        </span>
                      </div>
                      
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        <p>
                          {format(new Date(movement.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                        {movement.profiles && (
                          <p>By: {movement.profiles.full_name || movement.profiles.email || 'Unknown'}</p>
                        )}
                        {movement.batch_number && (
                          <p>Batch: {movement.batch_number}</p>
                        )}
                        {movement.expiry_date && (
                          <p>Expires: {format(new Date(movement.expiry_date), 'MMM d, yyyy')}</p>
                        )}
                        {movement.notes && (
                          <p className="text-muted-foreground/80 italic">"{movement.notes}"</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-medium">{movement.runningBalance}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default StockHistoryDialog;
