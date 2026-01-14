import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { PauseCircle, Play, Trash2, Clock, ShoppingCart, User } from 'lucide-react';
import type { HeldSale } from '@/hooks/useHoldSale';

interface HeldSalesPanelProps {
  heldSales: HeldSale[];
  onResume: (saleId: string) => void;
  onDelete: (saleId: string) => void;
  triggerButton?: React.ReactNode;
}

const HeldSalesPanel = ({ heldSales, onResume, onDelete, triggerButton }: HeldSalesPanelProps) => {
  if (heldSales.length === 0 && !triggerButton) {
    return null;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm" className="relative">
            <PauseCircle className="w-4 h-4 mr-1" />
            Held Sales
            {heldSales.length > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {heldSales.length}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-primary" />
            Held Sales ({heldSales.length})
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {heldSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <PauseCircle className="w-12 h-12 mb-3 opacity-40" />
              <p className="font-medium">No held sales</p>
              <p className="text-sm">Parked transactions will appear here</p>
            </div>
          ) : (
            heldSales.map((sale) => (
              <div
                key={sale.id}
                className="bg-secondary/50 rounded-lg p-4 border border-border"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    {sale.customerName && (
                      <div className="flex items-center gap-1.5 text-sm font-medium mb-1">
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
                <div className="text-sm text-muted-foreground mb-3 space-y-0.5">
                  {sale.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate flex-1">{item.quantity}x {item.name}</span>
                      <span className="tabular-nums ml-2">KES {item.total.toLocaleString()}</span>
                    </div>
                  ))}
                  {sale.items.length > 3 && (
                    <div className="text-xs text-muted-foreground/70">
                      +{sale.items.length - 3} more items...
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="flex justify-between items-center pt-2 border-t border-border mb-3">
                  <span className="font-medium">Total</span>
                  <span className="font-bold text-primary tabular-nums">
                    KES {sale.total.toLocaleString()}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => onDelete(sale.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => onResume(sale.id)}
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    Resume
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default HeldSalesPanel;
