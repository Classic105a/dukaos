import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * DukaOS global card system.
 * Every module surface (widget, panel, list container) must use <Surface>
 * instead of hand-rolled `bg-card border rounded-*` combinations.
 */
export const surfaceVariants = cva(
  'relative rounded-xl border bg-card text-card-foreground transition-shadow',
  {
    variants: {
      tone: {
        default: 'border-border',
        primary: 'border-primary/25 bg-primary/[0.04]',
        success: 'border-success/25 bg-success/[0.05]',
        warning: 'border-warning/30 bg-warning/[0.06]',
        danger: 'border-destructive/30 bg-destructive/[0.05]',
        muted: 'border-border bg-muted/40',
      },
      elevation: {
        flat: '',
        soft: 'shadow-soft',
        raised: 'shadow-elevated',
      },
      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-5',
      },
      interactive: {
        true: 'cursor-pointer hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        false: '',
      },
    },
    defaultVariants: { tone: 'default', elevation: 'soft', padding: 'md', interactive: false },
  }
);

export interface SurfaceProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof surfaceVariants> {}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, tone, elevation, padding, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(surfaceVariants({ tone, elevation, padding, interactive }), className)}
      {...props}
    />
  )
);
Surface.displayName = 'Surface';

interface SurfaceHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const SurfaceHeader = ({ title, description, icon, action, className }: SurfaceHeaderProps) => (
  <div className={cn('flex items-start justify-between gap-3 mb-3 min-w-0', className)}>
    <div className="flex items-start gap-2.5 min-w-0">
      {icon && (
        <span className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:w-4 [&_svg]:h-4">{icon}</span>
      )}
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-tight truncate">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 break-words">{description}</p>
        )}
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);