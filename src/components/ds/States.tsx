import { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Compact in-widget empty state (page-level empties still use <EmptyState />). */
export const InlineEmpty = ({
  icon: Icon = CheckCircle2,
  message,
  className,
}: {
  icon?: LucideIcon;
  message: string;
  className?: string;
}) => (
  <div className={cn('flex flex-col items-center justify-center gap-2 py-6 text-center', className)}>
    <Icon className="w-6 h-6 text-muted-foreground/60" />
    <p className="text-xs text-muted-foreground max-w-[22ch]">{message}</p>
  </div>
);

/** Canonical error state with a retry affordance. */
export const ErrorState = ({
  title = 'Something went wrong',
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) => (
  <div className={cn('flex flex-col items-center justify-center gap-2 py-6 text-center', className)}>
    <AlertTriangle className="w-6 h-6 text-destructive" />
    <p className="text-sm font-medium">{title}</p>
    {description && <p className="text-xs text-muted-foreground max-w-[32ch]">{description}</p>}
    {onRetry && (
      <Button size="sm" variant="outline" className="mt-1" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);