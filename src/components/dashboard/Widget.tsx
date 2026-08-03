import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Surface, SurfaceHeader, ErrorState, ListSkeleton } from '@/components/ds';
import { cn } from '@/lib/utils';

export interface WidgetProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Deep-link to the owning module. */
  href?: string;
  hrefLabel?: string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted';
  className?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

/**
 * Shared dashboard widget shell — one loading, error and empty contract for
 * every Command Center card. Widgets never define their own chrome.
 */
export const Widget = ({
  title,
  description,
  icon,
  href,
  hrefLabel = 'Open',
  loading,
  error,
  onRetry,
  tone = 'default',
  className,
  headerAction,
  children,
}: WidgetProps) => (
  <Surface tone={tone} className={cn('flex flex-col min-w-0', className)}>
    <SurfaceHeader
      title={title}
      description={description}
      icon={icon}
      action={
        headerAction ??
        (href ? (
          <Link
            to={href}
            className="inline-flex items-center gap-1 text-2xs font-medium text-primary hover:underline"
          >
            {hrefLabel}
            <ArrowRight className="w-3 h-3" />
          </Link>
        ) : null)
      }
    />
    <div className="flex-1 min-w-0">
      {loading ? <ListSkeleton rows={3} /> : error ? <ErrorState onRetry={onRetry} /> : children}
    </div>
  </Surface>
);

/** Standard row inside a widget list. */
export const WidgetRow = ({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) => {
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 py-2 min-w-0 text-left border-b border-border/60 last:border-0',
        onClick && 'hover:bg-muted/50 rounded-md px-1 -mx-1 transition-colors'
      )}
    >
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium truncate">{title}</span>
        {subtitle && <span className="block text-2xs text-muted-foreground truncate">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-sm font-semibold tabular-nums">{trailing}</span>}
    </Comp>
  );
};