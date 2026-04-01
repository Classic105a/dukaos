import { Button } from '@/components/ui/button';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CartItem {
  id: string;
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total: number;
  maxStock?: number;
}

interface CartProps {
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

const Cart = ({ items, onUpdateQuantity, onRemoveItem, onClearCart, subtotal, tax, discount, total, onCheckout }: CartProps) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <ShoppingBag className="w-10 h-10 opacity-20 mb-3" />
        <p className="text-sm font-medium">Cart is empty</p>
        <p className="text-xs mt-1">Tap products to add</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
        <span className="font-bold text-sm">Cart ({items.length})</span>
        <button onClick={onClearCart} className="text-xs text-destructive hover:underline">Clear</button>
      </div>

      {/* Items — scrollable */}
      <div className="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1">
        {items.map(item => {
          const maxStock = item.maxStock ?? Infinity;
          const canIncrease = item.quantity < maxStock;
          return (
            <div key={item.id} className="flex items-center gap-2 py-1.5 group">
              {/* Name + price */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{item.unit_price.toLocaleString()} × {item.quantity}</p>
              </div>

              {/* Qty controls — compact */}
              <div className="flex items-center bg-secondary rounded-md">
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-bold tabular-nums">{item.quantity}</span>
                <button
                  onClick={() => canIncrease && onUpdateQuantity(item.id, item.quantity + 1)}
                  disabled={!canIncrease}
                  className={cn("p-1.5", canIncrease ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/20")}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Subtotal */}
              <span className="text-sm font-bold tabular-nums min-w-[50px] text-right">
                {item.total.toLocaleString()}
              </span>

              {/* Remove */}
              <button
                onClick={() => onRemoveItem(item.id)}
                className="p-1 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Summary + PAY */}
      <div className="border-t border-border pt-3 mt-2 space-y-1.5">
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
        {discount > 0 && (
          <div className="flex justify-between text-xs text-emerald-600">
            <span>Discount</span>
            <span className="tabular-nums">-KES {discount.toLocaleString()}</span>
          </div>
        )}

        {/* TOTAL — large, bold, always visible */}
        <div className="flex justify-between items-baseline pt-2 border-t border-border">
          <span className="text-lg font-bold">TOTAL</span>
          <span className="text-2xl font-black text-primary tabular-nums">KES {total.toLocaleString()}</span>
        </div>

        {/* PAY button — most visible element */}
        <Button
          onClick={onCheckout}
          className="w-full h-14 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground mt-2"
        >
          PAY KES {total.toLocaleString()}
        </Button>
      </div>
    </div>
  );
};

export default Cart;
