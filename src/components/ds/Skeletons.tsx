import { cn } from '@/lib/utils';
import { Surface } from './Surface';

/** Base shimmer block. Never use a spinner where a skeleton can be used. */
export const SkeletonBlock = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded bg-muted', className)} />
);

export const WidgetSkeleton = ({ lines = 3, className }: { lines?: number; className?: string }) => (
  <Surface className={cn('space-y-3', className)}>
    <div className="flex items-center justify-between">
      <SkeletonBlock className="h-4 w-32" />
      <SkeletonBlock className="h-4 w-4 rounded-md" />
    </div>
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <SkeletonBlock className="h-8 w-8 rounded-lg shrink-0" />
        <SkeletonBlock className="h-3 flex-1" />
        <SkeletonBlock className="h-3 w-12 shrink-0" />
      </div>
    ))}
  </Surface>
);

export const StatSkeleton = ({ className }: { className?: string }) => (
  <Surface className={cn('space-y-2', className)}>
    <SkeletonBlock className="h-3 w-20" />
    <SkeletonBlock className="h-7 w-28" />
    <SkeletonBlock className="h-3 w-16" />
  </Surface>
);

export const ListSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <SkeletonBlock className="h-8 w-8 rounded-lg shrink-0" />
        <SkeletonBlock className="h-3 flex-1" />
        <SkeletonBlock className="h-3 w-14 shrink-0" />
      </div>
    ))}
  </div>
);

export const ChartSkeleton = ({ height = 180 }: { height?: number }) => (
  <div className="flex items-end gap-2 animate-pulse" style={{ height }}>
    {[40, 70, 55, 90, 65, 80, 50].map((h, i) => (
      <div key={i} className="flex-1 rounded-t bg-muted" style={{ height: `${h}%` }} />
    ))}
  </div>
);