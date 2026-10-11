import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  total: number;
  onConfirm: (cash: number, mpesa: number, mpesaRef: string, mpesaPhone: string) => void;
  onCancel: () => void;
}

/** Part cash, part M-Pesa. Works offline — the M-Pesa code is recorded and checked on sync. */
const SplitTenderPanel = ({ total, onConfirm, onCancel }: Props) => {
  const [cash, setCash] = useState(0);
  const [ref, setRef] = useState('');
  const [phone, setPhone] = useState('');
  const mpesa = Math.max(0, Math.round((total - cash) * 100) / 100);
  const valid = cash > 0 && cash < total && ref.trim().length >= 6;

  const field = "w-full h-12 mt-1 rounded-xl border border-input bg-card px-3 text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-muted-foreground font-medium uppercase">Cash
          <input type="number" inputMode="decimal" autoFocus value={cash || ''} className={cn(field, 'tabular-nums')}
            onChange={e => setCash(Math.min(total, parseFloat(e.target.value) || 0))} />
        </label>
        <div className="text-[11px] text-muted-foreground font-medium uppercase">M-Pesa
          <div className="h-12 mt-1 rounded-xl bg-success/10 text-success px-3 flex items-center text-lg font-black tabular-nums">
            {mpesa.toLocaleString()}
          </div>
        </div>
      </div>
      <input value={ref} maxLength={20} placeholder="M-Pesa code e.g. SJK7X2ABCD" className={cn(field, 'text-base uppercase')}
        onChange={e => setRef(e.target.value.toUpperCase())} />
      <input value={phone} maxLength={15} inputMode="tel" placeholder="Phone (optional)" className={cn(field, 'text-base font-medium')}
        onChange={e => setPhone(e.target.value)} />
      <div className="flex gap-2">
        <button onClick={onCancel} aria-label="Back" className="px-5 h-14 rounded-xl bg-secondary text-foreground">
          <X className="w-5 h-5" />
        </button>
        <button disabled={!valid} onClick={() => onConfirm(cash, mpesa, ref.trim(), phone.trim())}
          className={cn("flex-1 h-14 rounded-xl font-bold flex items-center justify-center gap-2",
            valid ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")}>
          <Check className="w-5 h-5" />Complete split sale
        </button>
      </div>
    </div>
  );
};

export default SplitTenderPanel;
