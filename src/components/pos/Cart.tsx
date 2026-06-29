import { useState } from 'react';
import { Trash2, Plus, Minus, ShoppingBag, Banknote, Smartphone, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import CashTenderPanel from './CashTenderPanel';

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
  total: number;
  onCashPayment: (cashReceived: number) => void;
  onCardPayment: () => void;
  onMpesaPayment: () => void;
}

const Cart = ({ items, onUpdateQuantity, onRemoveItem, onClearCart, subtotal: _subtotal, tax, total, onCashPayment, onCardPayment, onMpesaPayment }: CartProps) => {
  const [showCashTender, setShowCashTender] = useState(false);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <ShoppingBag className="w-10 h-10 opacity-15 mb-2" />
        <p className="text-sm font-medium">Cart empty</p>
        <p className="text-xs mt-0.5">Tap products to add</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-1 border-b border-border">
        <span className="font-bold text-sm">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        <button onClick={onClearCart} className="text-[10px] text-destructive font-medium uppercase tracking-wide">Clear</button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto space-y-0.5 -mx-1 px-1 min-h-0">
        {items.map(item => {
          const maxStock = item.maxStock ?? Infinity;
          const canIncrease = item.quantity < maxStock;
          return (
            <div key={item.id} className="flex items-center gap-1.5 py-1.5 group">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">{item.unit_price.toLocaleString()}</p>
              </div>
              <div className="flex items-center bg-secondary rounded">
                <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="px-1.5 py-1">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-5 text-center text-xs font-bold tabular-nums">{item.quantity}</span>
                <button
                  onClick={() => canIncrease && onUpdateQuantity(item.id, item.quantity + 1)}
                  disabled={!canIncrease}
                  className={cn("px-1.5 py-1", !canIncrease && "opacity-20")}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="text-xs font-bold tabular-nums min-w-[44px] text-right">{item.total.toLocaleString()}</span>
              <button onClick={() => onRemoveItem(item.id)} className="p-0.5 text-muted-foreground/30 hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* TOTAL */}
      <div className="border-t border-border pt-2 mt-1">
        {tax > 0 && (
          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>Tax incl.</span>
            <span className="tabular-nums">KES {tax.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline">
          <span className="text-base font-bold">TOTAL</span>
          <span className="text-2xl font-black text-primary tabular-nums">KES {total.toLocaleString()}</span>
        </div>
      </div>

      {/* Payment area */}
      <div className="pt-3 space-y-2">
        {showCashTender ? (
          <CashTenderPanel
            total={total}
            onConfirm={(cashReceived) => {
              setShowCashTender(false);
              onCashPayment(cashReceived);
            }}
            onCancel={() => setShowCashTender(false)}
          />
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => setShowCashTender(true)}
              className="flex flex-col items-center gap-1 py-3 rounded-xl bg-success text-white font-bold text-sm active:bg-success/90"
            >
              <Banknote className="w-5 h-5" />
              CASH
            </button>
            <button
              onClick={onMpesaPayment}
              className="flex flex-col items-center gap-1 py-3 rounded-xl bg-[#4caf50] text-white font-bold text-sm active:bg-[#43a047]"
            >
              <Smartphone className="w-5 h-5" />
              M-PESA
            </button>
            <button
              onClick={onCardPayment}
              className="flex flex-col items-center gap-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:bg-primary/90"
            >
              <CreditCard className="w-5 h-5" />
              CARD
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
