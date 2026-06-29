import { Store } from 'lucide-react';

/** Full-page loading state with brand identity */
export const FullPageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
    <div className="w-14 h-14 bg-gradient-hero rounded-2xl flex items-center justify-center shadow-glow">
      <Store className="w-7 h-7 text-primary-foreground" />
    </div>
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground font-medium">Loading DukaOS</span>
    </div>
  </div>
);

/** Card skeleton for dashboard widgets */
export const CardSkeleton = ({ className = '' }: { className?: string }) => (
  <div className={`bg-card rounded-xl border border-border p-5 animate-pulse ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="h-4 w-24 bg-muted rounded" />
      <div className="h-8 w-8 bg-muted rounded-lg" />
    </div>
    <div className="h-8 w-32 bg-muted rounded mb-2" />
    <div className="h-3 w-20 bg-muted rounded" />
  </div>
);

/** Table skeleton */
export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="bg-card rounded-xl border border-border overflow-hidden animate-pulse">
    <div className="h-12 bg-muted/50 border-b border-border" />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
        <div className="h-4 w-4 bg-muted rounded" />
        <div className="h-4 flex-1 bg-muted rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="h-4 w-16 bg-muted rounded" />
      </div>
    ))}
  </div>
);
