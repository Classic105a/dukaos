import { useState, useEffect, useRef } from 'react';
import { Banknote, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const QUICK_DENOMINATIONS = [1000, 2000, 5000, 10000];

interface CashTenderPanelProps {
  total: number;
  onConfirm: (cashReceived: number) => void;
  onCancel: () => void;
}

const CashTenderPanel = ({ total, onConfirm, onCancel }: CashTenderPanelProps) => {
  const [cashReceived, setCashReceived] = useState(total);
  const inputRef = useRef<HTMLInputElement>(null);
  const change = Math.max(0, cashReceived - total);
  const isValid = cashReceived >= total;

  useEffect(() => {
    setCashReceived(total);
    // Small delay to ensure DOM is ready after render
    setTimeout(() => inputRef.current?.select(), 50);
  }, [total]);

  return (
    <div className="space-y-2 animate-in slide-in-from-bottom-2 duration-200">
      {/* Cash received input */}
      <div>
        <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Cash Received</label>
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={cashReceived || ''}
          onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
          className="w-full h-12 mt-1 rounded-lg border border-input bg-card px-3 text-xl font-bold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
          autoFocus
        />
      </div>

      {/* Quick denomination buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setCashReceived(total)}
          className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold active:scale-95 transition-transform"
        >
          Exact
        </button>
        {QUICK_DENOMINATIONS.filter(d => d >= total).slice(0, 3).map(amt => (
          <button
            key={amt}
            onClick={() => setCashReceived(amt)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold tabular-nums active:scale-95 transition-transform",
              cashReceived === amt
                ? "bg-success/20 text-success ring-1 ring-success/30"
                : "bg-secondary text-foreground"
            )}
          >
            {amt.toLocaleString()}
          </button>
        ))}
      </div>

      {/* Change display */}
      {isValid && change > 0 && (
        <div className="bg-success/10 rounded-lg p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Change</p>
          <p className="text-2xl font-black text-success tabular-nums">
            KES {change.toLocaleString()}
          </p>
        </div>
      )}

      {!isValid && (
        <div className="bg-destructive/10 rounded-lg p-2 text-center">
          <p className="text-xs text-destructive font-medium">
            Short by KES {(total - cashReceived).toLocaleString()}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl bg-secondary text-foreground font-medium text-sm active:scale-95 transition-transform"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={() => isValid && onConfirm(cashReceived)}
          disabled={!isValid}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform",
            isValid
              ? "bg-success text-white"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Check className="w-5 h-5" />
          <span>Complete Sale</span>
          {change > 0 && isValid && (
            <span className="text-xs opacity-80">• Change {change.toLocaleString()}</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default CashTenderPanel;
