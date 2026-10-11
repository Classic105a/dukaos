import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Trash2, Plus, Minus, Banknote, Smartphone, CreditCard, Split, WifiOff } from 'lucide-react';
import { CartItem } from './Cart';
import { cn } from '@/lib/utils';
import CashTenderPanel from './CashTenderPanel';
import SplitTenderPanel from './SplitTenderPanel';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

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
  onSplitPayment?: (cash: number, mpesa: number, ref: string, phone: string) => void;
}

type Mode = 'choose' | 'cash' | 'split';

const MobileCartSheet = ({
  isOpen, onClose, items, onUpdateQuantity, onRemoveItem, onClearCart,
  total, onCashPayment, onCardPayment, onMpesaPayment, onSplitPayment,
}: MobileCartSheetProps) => {
  const [mode, setMode] = useState<Mode>('choose');
  const online = useOnlineStatus();
  const close = () => { setMode('choose'); onClose(); };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent side="bottom" className="h-[92dvh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold">{items.length} item{items.length !== 1 ? 's' : ''}</SheetTitle>
            {items.length > 0 && (
              <button onClick={onClearCart} className="h-10 px-3 text-xs text-destructive font-semibold uppercase">Clear</button>
            )}
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Cart empty</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-1">
              {items.map(item => {
                const canIncrease = item.quantity < (item.maxStock ?? Infinity);
                return (
                  <div key={item.id} className="flex items-center gap-2 py-2.5 border-b border-border/40 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {item.unit_price.toLocaleString()} · <span className="font-bold text-foreground">{item.total.toLocaleString()}</span>
                      </p>
                    </div>
                    <div className="flex items-center bg-secondary rounded-xl">
                      <button aria-label="Less" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="w-11 h-11 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                      <span className="w-7 text-center font-bold tabular-nums">{item.quantity}</span>
                      <button aria-label="More" onClick={() => canIncrease && onUpdateQuantity(item.id, item.quantity + 1)} disabled={!canIncrease}
                        className={cn("w-11 h-11 flex items-center justify-center", !canIncrease && "opacity-30")}><Plus className="w-4 h-4" /></button>
                    </div>
                    <button aria-label="Remove" onClick={() => onRemoveItem(item.id)} className="w-10 h-11 flex items-center justify-center text-muted-foreground"><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border p-4 bg-card space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-muted-foreground">TOTAL</span>
                <span className="text-3xl font-black text-primary tabular-nums">KES {total.toLocaleString()}</span>
              </div>
              {!online && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <WifiOff className="w-3.5 h-3.5" />Offline — sales are saved and sent when you reconnect.
                </p>
              )}

              {mode === 'cash' && (
                <CashTenderPanel total={total} onCancel={() => setMode('choose')}
                  onConfirm={(c) => { setMode('choose'); onCashPayment(c); }} />
              )}
              {mode === 'split' && onSplitPayment && (
                <SplitTenderPanel total={total} onCancel={() => setMode('choose')}
                  onConfirm={(c, m, r, p) => { setMode('choose'); onSplitPayment(c, m, r, p); }} />
              )}
              {mode === 'choose' && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setMode('cash')} className="h-16 rounded-2xl bg-success text-success-foreground font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98]">
                    <Banknote className="w-6 h-6" />Cash
                  </button>
                  <button onClick={onMpesaPayment} className="h-16 rounded-2xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98]">
                    <Smartphone className="w-6 h-6" />M-Pesa
                  </button>
                  {onSplitPayment && (
                    <button onClick={() => setMode('split')} className="h-12 rounded-xl bg-secondary text-foreground font-semibold text-sm flex items-center justify-center gap-2">
                      <Split className="w-4 h-4" />Split cash + M-Pesa
                    </button>
                  )}
                  <button onClick={onCardPayment} className={cn("h-12 rounded-xl bg-secondary text-foreground font-semibold text-sm flex items-center justify-center gap-2", !onSplitPayment && "col-span-2")}>
                    <CreditCard className="w-4 h-4" />Card
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default MobileCartSheet;
