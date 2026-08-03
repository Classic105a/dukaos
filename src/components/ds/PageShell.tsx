import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Canonical page layout for every DukaOS module:
 *   title → context actions → search → filters → main content → secondary actions
 * Modules must not invent their own page chrome.
 */
export interface PageShellProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** Primary/context actions rendered next to the title. */
  actions?: ReactNode;
  /** Search input row (use <SearchBar />). */
  search?: ReactNode;
  /** Filter controls (use <FilterBar />). */
  filters?: ReactNode;
  /** Low-priority actions rendered under the main content. */
  secondaryActions?: ReactNode;
  /** Status feedback line (sync state, last updated, errors). */
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const PageShell = ({
  title,
  description,
  icon,
  actions,
  search,
  filters,
  secondaryActions,
  status,
  children,
  className,
}: PageShellProps) => (
  <div className={cn('w-full min-w-0 max-w-[1600px] mx-auto space-y-4', className)}>
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center text-primary-foreground [&_svg]:w-5 [&_svg]:h-5">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 break-words">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {actions}
        </div>
      )}
    </header>

    {(search || filters) && (
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center min-w-0">
        {search && <div className="w-full lg:max-w-sm min-w-0">{search}</div>}
        {filters && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 lg:ml-auto">
            {filters}
          </div>
        )}
      </div>
    )}

    {status && <div className="text-xs text-muted-foreground">{status}</div>}

    <main className="min-w-0 space-y-4">{children}</main>

    {secondaryActions && (
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
        {secondaryActions}
      </div>
    )}
  </div>
);