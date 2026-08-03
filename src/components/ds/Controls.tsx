import { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Global search input. Same affordance on every module. */
export const SearchBar = ({ value, onChange, placeholder = 'Search…', className }: SearchBarProps) => (
  <div className={cn('relative min-w-0', className)}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    <Input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="pl-9 pr-9 h-10"
      inputMode="search"
    />
    {value && (
      <button
        type="button"
        aria-label="Clear search"
        onClick={() => onChange('')}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

/** Horizontal, never-overflowing filter strip. */
export const FilterBar = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex items-center gap-2 min-w-0', className)}>{children}</div>
);

interface FilterChipProps {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export const FilterChip = ({ active, onClick, children }: FilterChipProps) => (
  <Button
    type="button"
    size="sm"
    variant={active ? 'default' : 'outline'}
    onClick={onClick}
    className="h-9 shrink-0 rounded-full px-3 text-xs"
  >
    {children}
  </Button>
);