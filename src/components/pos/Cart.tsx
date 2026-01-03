import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Minus, ShoppingBag, CreditCard } from 'lucide-react';

export interface CartItem {
  id: string;
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  total: number;
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

const Cart = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  subtotal,
  tax,
  discount,
  total,
  onCheckout
}: CartProps) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <ShoppingBag className="w-8 h-8 opacity-40" />
        </div>
        <p className="text-base font-medium text-foreground mb-1">Cart is empty</p>
        <p className="text-sm">Add products to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
        <h3 className="font-bold text-sm">Current Sale</h3>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin -mx-1 px-1">
        {items.map(item => (
          <div
            key={item.id}
            className="bg-secondary/50 rounded-lg p-2.5 flex items-center gap-2"
          >
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate leading-tight">{item.name}</h4>
              <p className="text-xs text-muted-foreground">
                KES {item.unit_price.toLocaleString()}
              </p>
            </div>
            
            {/* Quantity Controls - Compact */}
            <div className="flex items-center bg-card rounded-md border border-border">
              <button
                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-l-md transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <Input
                type="number"
                value={item.quantity}
                onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                className="w-8 h-7 text-center text-xs px-0 border-0 bg-transparent focus-visible:ring-0"
                min={1}
              />
              <button
                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-r-md transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Item Total & Remove */}
            <div className="text-right flex items-center gap-2">
              <p className="font-bold text-sm tabular-nums">
                {item.total.toLocaleString()}
              </p>
              <button
                onClick={() => onRemoveItem(item.id)}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Summary */}
      <div className="border-t border-border pt-3 mt-3 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">KES {subtotal.toLocaleString()}</span>
        </div>
        {tax > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span className="tabular-nums">KES {tax.toLocaleString()}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-sm text-success">
            <span>Discount</span>
            <span className="tabular-nums">-KES {discount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-border">
          <span className="text-base font-bold">Total</span>
          <span className="text-xl font-bold text-primary tabular-nums">
            KES {total.toLocaleString()}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3">
          <Button 
            variant="outline" 
            size="sm"
            className="h-10"
            onClick={onClearCart}
          >
            Clear
          </Button>
          <Button 
            variant="accent"
            size="lg"
            className="flex-1 h-12 text-base font-bold"
            onClick={onCheckout}
          >
            <CreditCard className="w-5 h-5" />
            Checkout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Cart;