import { ReactNode, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Surface } from './Surface';
import { ListSkeleton } from './Skeletons';
import { InlineEmpty } from './States';

export interface DataTableColumn<T> {
  /** Stable key, also used as the sort key. */
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  cell: (row: T) => ReactNode;
  /** Return a comparable primitive to enable client-side sorting. */
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  headerClassName?: string;
  /** Hide on small screens (the mobile card view renders the same cells). */
  hideOnMobile?: boolean;
  align?: 'left' | 'right' | 'center';
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Enables checkbox selection when provided. */
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  /** Sticky first data column on horizontal scroll. */
  stickyFirstColumn?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Rendered above the table when rows are selected. */
  bulkActions?: (selectedIds: string[]) => ReactNode;
  /** Mobile card renderer. Falls back to a stacked label/value list. */
  mobileRow?: (row: T) => ReactNode;
  className?: string;
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

const alignClass = (align?: DataTableColumn<unknown>['align']) =>
  align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

/**
 * Canonical DukaOS table. Sticky header, optional sticky first column,
 * selection + bulk actions, client-side sorting, skeleton and empty states,
 * and an automatic card layout on mobile (never scrolls horizontally there).
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  selectedIds,
  onSelectionChange,
  onRowClick,
  stickyFirstColumn,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  bulkActions,
  mobileRow,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);
  const selectable = !!onSelectionChange;
  const selected = selectedIds ?? [];

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a) ?? '';
      const bv = col.sortValue!(b) ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, columns, sort]);

  const toggleSort = (key: string) =>
    setSort(prev =>
      prev?.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : null
    );

  const allSelected = sorted.length > 0 && selected.length === sorted.length;
  const toggleAll = () =>
    onSelectionChange?.(allSelected ? [] : sorted.map(rowKey));
  const toggleOne = (id: string) =>
    onSelectionChange?.(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);

  if (loading) {
    return (
      <Surface padding="md" className={className}>
        <ListSkeleton rows={6} />
      </Surface>
    );
  }

  if (!sorted.length) {
    return (
      <Surface padding="lg" className={className}>
        <div className="space-y-3">
          <InlineEmpty message={emptyDescription ? `${emptyTitle} — ${emptyDescription}` : emptyTitle} />
          {emptyAction && <div className="flex justify-center">{emptyAction}</div>}
        </div>
      </Surface>
    );
  }

  return (
    <div className={cn('min-w-0 space-y-2', className)}>
      {selectable && selected.length > 0 && bulkActions && (
        <Surface tone="primary" padding="sm" className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium">{selected.length} selected</span>
          <div className="flex flex-wrap items-center gap-2 ml-auto">{bulkActions(selected)}</div>
        </Surface>
      )}

      {/* Desktop / tablet table */}
      <Surface padding="none" className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              <tr>
                {selectable && (
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                  </th>
                )}
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap',
                      alignClass(col.align),
                      stickyFirstColumn && i === 0 && 'sticky left-0 z-10 bg-muted/60',
                      col.headerClassName
                    )}
                  >
                    {col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {col.header}
                        {sort?.key === col.key ? (
                          sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ChevronsUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => {
                const id = rowKey(row);
                const isSelected = selected.includes(id);
                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-t border-border transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-muted/40',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    {selectable && (
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columns.map((col, i) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2.5 align-middle',
                          alignClass(col.align),
                          stickyFirstColumn && i === 0 && 'sticky left-0 z-[1] bg-card',
                          col.className
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>

      {/* Mobile cards — no horizontal scrolling on small screens */}
      <div className="md:hidden space-y-2">
        {sorted.map(row => {
          const id = rowKey(row);
          const isSelected = selected.includes(id);
          return (
            <Surface
              key={id}
              padding="sm"
              interactive={!!onRowClick}
              tone={isSelected ? 'primary' : 'default'}
              onClick={() => onRowClick?.(row)}
              className="min-w-0"
            >
              <div className="flex items-start gap-2 min-w-0">
                {selectable && (
                  <div onClick={e => e.stopPropagation()} className="pt-0.5">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(id)} aria-label="Select row" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {mobileRow ? (
                    mobileRow(row)
                  ) : (
                    <div className="space-y-1">
                      {columns
                        .filter(c => !c.hideOnMobile)
                        .map(col => (
                          <div key={col.key} className="flex items-start justify-between gap-3 min-w-0">
                            <span className="text-2xs uppercase tracking-wide text-muted-foreground shrink-0">
                              {col.header}
                            </span>
                            <span className="text-sm text-right min-w-0 break-words">{col.cell(row)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </Surface>
          );
        })}
      </div>
    </div>
  );
}