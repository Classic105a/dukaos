import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PauseCircle, Play, Trash2, Clock, ShoppingCart, User } from 'lucide-react';
import type { HeldSale } from '@/hooks/useHoldSale';

interface HeldSalesPanelProps {
  heldSales: HeldSale[];
  onResume: (saleId: string) => void;
  onDelete: (saleId: string) => void;
}

const HeldSalesPanel = ({ heldSales, onResume, onDelete }: HeldSalesPanelProps) => {
  if (heldSales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-muted-foreground">
        <PauseCircle className="w-10 h-10 mb-2 opacity-40" />
        <p className="font-medium text-sm">No held sales</p>
        <p className="text-xs">Parked transactions will appear here</p>
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-80">
      <div className="p-2 space-y-2">
        {heldSales.map((sale) => (
          <div
            key={sale.id}
            className="bg-secondary/50 rounded-lg p-3 border border-border"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                {sale.customerName && (
                  <div className="flex items-center gap-1.5 text-sm font-medium mb-0.5">
                    <User className="w-3.5 h-3.5" />
                    {sale.customerName}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {format(sale.createdAt, 'h:mm a')}
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                <ShoppingCart className="w-3 h-3 mr-1" />
                {sale.items.reduce((sum, item) => sum + item.quantity, 0)} items
              </Badge>
            </div>

            {/* Items preview */}
            <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
              {sale.items.slice(0, 2).map((item, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="truncate flex-1">{item.quantity}x {item.name}</span>
                  <span className="tabular-nums ml-2">KES {item.total.toLocaleString()}</span>
                </div>
              ))}
              {sale.items.length > 2 && (
                <div className="text-xs text-muted-foreground/70">
                  +{sale.items.length - 2} more...
                </div>
              )}
            </div>

            {/* Total & Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="font-bold text-primary tabular-nums text-sm">
                KES {sale.total.toLocaleString()}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  onClick={() => onDelete(sale.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-3"
                  onClick={() => onResume(sale.id)}
                >
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Resume
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default HeldSalesPanel;
