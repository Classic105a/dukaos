import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Trash2, Plus, Minus, Banknote, Smartphone, CreditCard } from 'lucide-react';
import { CartItem } from './Cart';
import { cn } from '@/lib/utils';
import CashTenderPanel from './CashTenderPanel';

interface MobileCartSheetProps {
  isOpen: boolean;
  onClose: () => void;
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

const MobileCartSheet = ({
  isOpen, onClose, items, onUpdateQuantity, onRemoveItem, onClearCart,
  subtotal: _subtotal, tax: _tax, total, onCashPayment, onCardPayment, onMpesaPayment,
}: MobileCartSheetProps) => {
  const [showCashTender, setShowCashTender] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) { setShowCashTender(false); onClose(); } }}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-2.5 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-bold">{items.length} item{items.length !== 1 ? 's' : ''}</SheetTitle>
            {items.length > 0 && <button onClick={onClearCart} className="text-[10px] text-destructive font-medium uppercase">Clear</button>}
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Cart empty</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-1 space-y-1">
              {items.map(item => {
                const maxStock = item.maxStock ?? Infinity;
                const canIncrease = item.quantity < maxStock;
                return (
                  <div key={item.id} className="flex items-center gap-2 py-2 border-b border-border/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{item.unit_price.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center bg-secondary rounded">
                      <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="p-2"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                      <button onClick={() => canIncrease && onUpdateQuantity(item.id, item.quantity + 1)} disabled={!canIncrease} className={cn("p-2", !canIncrease && "opacity-20")}><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                    <span className="text-sm font-bold tabular-nums min-w-[48px] text-right">{item.total.toLocaleString()}</span>
                    <button onClick={() => onRemoveItem(item.id)} className="p-1 text-muted-foreground/30"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
            </div>

            {/* Bottom: Total + payment */}
            <div className="border-t border-border p-4 bg-card space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-base font-bold">TOTAL</span>
                <span className="text-2xl font-black text-primary tabular-nums">KES {total.toLocaleString()}</span>
              </div>

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
                <>
                  {/* Payment buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button onClick={() => setShowCashTender(true)} className="flex flex-col items-center gap-1 py-3 rounded-xl bg-success text-white font-bold text-sm active:bg-success/90">
                      <Banknote className="w-5 h-5" />CASH
                    </button>
                    <button onClick={onMpesaPayment} className="flex flex-col items-center gap-1 py-3 rounded-xl bg-[#4caf50] text-white font-bold text-sm active:bg-[#43a047]">
                      <Smartphone className="w-5 h-5" />M-PESA
                    </button>
                    <button onClick={onCardPayment} className="flex flex-col items-center gap-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:bg-primary/90">
                      <CreditCard className="w-5 h-5" />CARD
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default MobileCartSheet;
