import { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Surface } from './Surface';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Percentage change vs the previous comparable period. */
  delta?: number | null;
  hint?: ReactNode;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
  className?: string;
}

/** Secondary-priority KPI tile. Alerts outrank these on the Command Center. */
export const StatCard = ({ label, value, icon, delta, hint, tone = 'default', onClick, className }: StatCardProps) => {
  const up = (delta ?? 0) >= 0;
  return (
    <Surface
      tone={tone}
      padding="md"
      interactive={!!onClick}
      onClick={onClick}
      className={cn('min-w-0', className)}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
        {icon && <span className="shrink-0 text-muted-foreground [&_svg]:w-4 [&_svg]:h-4">{icon}</span>}
      </div>
      <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums truncate">{value}</div>
      <div className="flex items-center gap-1.5 mt-1 min-w-0">
        {typeof delta === 'number' && Number.isFinite(delta) && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-2xs font-semibold',
              up ? 'text-success' : 'text-destructive'
            )}
          >
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {hint && <span className="text-2xs text-muted-foreground truncate">{hint}</span>}
      </div>
    </Surface>
  );
};