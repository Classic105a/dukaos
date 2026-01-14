import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Minus, CreditCard, PauseCircle, XCircle, X } from 'lucide-react';
import { CartItem } from './Cart';

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
  onHold: () => void;
  onVoid: () => void;
}

const MobileCartSheet = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  subtotal,
  tax,
  discount,
  total,
  onCheckout,
  onHold,
  onVoid,
}: MobileCartSheetProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-lg font-bold">Cart</SheetTitle>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={onHold}
                >
                  <PauseCircle className="w-3.5 h-3.5 mr-1" />
                  Hold
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={onVoid}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Void
                </Button>
              </>
            )}
          </div>
        </SheetHeader>

        {/* Cart Items */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 opacity-40" />
            </div>
            <p className="text-base font-medium text-foreground mb-1">Cart is empty</p>
            <p className="text-sm">Add products to get started</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-2 py-3">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="bg-secondary/50 rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate leading-tight">{item.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        KES {item.unit_price.toLocaleString()} each
                      </p>
                    </div>
                    
                    {/* Quantity Controls */}
                    <div className="flex items-center bg-card rounded-lg border border-border">
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-l-lg transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                        className="w-10 h-8 text-center text-sm px-0 border-0 bg-transparent focus-visible:ring-0"
                        min={1}
                      />
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-r-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Item Total & Remove */}
                    <div className="text-right flex items-center gap-2">
                      <p className="font-bold text-sm tabular-nums min-w-[60px]">
                        {item.total.toLocaleString()}
                      </p>
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Cart Summary & Checkout */}
            <div className="border-t border-border p-4 bg-card space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">KES {subtotal.toLocaleString()}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (VAT)</span>
                    <span className="tabular-nums">KES {tax.toLocaleString()}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span className="tabular-nums">-KES {discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    KES {total.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="h-14"
                  onClick={onClearCart}
                >
                  Clear
                </Button>
                <Button 
                  variant="accent"
                  size="lg"
                  className="flex-1 h-14 text-lg font-bold"
                  onClick={() => {
                    onClose();
                    onCheckout();
                  }}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Checkout
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default MobileCartSheet;
