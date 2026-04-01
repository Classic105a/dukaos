import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Minus } from 'lucide-react';
import { CartItem } from './Cart';
import { cn } from '@/lib/utils';

interface MobileCartSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  onCheckout: () => void;
}

const MobileCartSheet = ({
  isOpen, onClose, items, onUpdateQuantity, onRemoveItem, onClearCart,
  subtotal, tax, discount, total, onCheckout,
}: MobileCartSheetProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold">Cart ({items.length})</SheetTitle>
            {items.length > 0 && (
              <button onClick={onClearCart} className="text-xs text-destructive">Clear All</button>
            )}
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Cart is empty
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
              {items.map(item => {
                const maxStock = item.maxStock ?? Infinity;
                const canIncrease = item.quantity < maxStock;
                return (
                  <div key={item.id} className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {item.unit_price.toLocaleString()} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center bg-secondary rounded-md">
                      <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="p-2">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                      <button
                        onClick={() => canIncrease && onUpdateQuantity(item.id, item.quantity + 1)}
                        disabled={!canIncrease}
                        className={cn("p-2", !canIncrease && "opacity-20")}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-bold tabular-nums min-w-[50px] text-right">
                      {item.total.toLocaleString()}
                    </span>
                    <button onClick={() => onRemoveItem(item.id)} className="p-1 text-muted-foreground/40">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border p-4 bg-card space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">KES {subtotal.toLocaleString()}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Tax</span>
                  <span className="tabular-nums">KES {tax.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-border">
                <span className="text-lg font-bold">TOTAL</span>
                <span className="text-2xl font-black text-primary tabular-nums">KES {total.toLocaleString()}</span>
              </div>
              <Button
                onClick={() => { onClose(); onCheckout(); }}
                className="w-full h-14 text-lg font-bold rounded-xl mt-1"
              >
                PAY KES {total.toLocaleString()}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default MobileCartSheet;
