import { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** Global status badge system — one vocabulary of tones across every module. */
export const statusBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap border',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground border-transparent',
        primary: 'bg-primary/10 text-primary border-primary/20',
        success: 'bg-success/10 text-success border-success/20',
        warning: 'bg-warning/10 text-warning border-warning/25',
        danger: 'bg-destructive/10 text-destructive border-destructive/20',
        info: 'bg-info/10 text-info border-info/20',
      },
      size: {
        sm: 'text-2xs px-1.5 py-0.5',
        md: 'text-xs px-2 py-0.5',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  }
);

export interface StatusBadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {}

export const StatusBadge = ({ className, tone, size, ...props }: StatusBadgeProps) => (
  <span className={cn(statusBadgeVariants({ tone, size }), className)} {...props} />
);

/** Maps common domain statuses to a canonical tone so modules stay consistent. */
export const statusTone = (status?: string | null): NonNullable<StatusBadgeProps['tone']> => {
  switch ((status || '').toLowerCase()) {
    case 'completed':
    case 'paid':
    case 'active':
    case 'received':
    case 'open':
      return 'success';
    case 'pending':
    case 'partial':
    case 'in_transit':
    case 'draft':
      return 'warning';
    case 'failed':
    case 'cancelled':
    case 'refunded':
    case 'overdue':
      return 'danger';
    case 'closed':
      return 'info';
    default:
      return 'neutral';
  }
};