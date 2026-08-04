import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/hooks/useBusiness';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { FEATURES } from '@/lib/feature-flags';
import {
  BarChart3,
  Building2,
  Clock,
  LayoutDashboard,
  Package,
  Percent,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  Warehouse as WarehouseIcon,
} from 'lucide-react';

const RECENT_KEY = 'dukaos:recent-routes';

interface NavCommand {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords?: string;
  enabled?: boolean;
}

const NAV_COMMANDS: NavCommand[] = [
  { label: 'Command Center', path: '/command-center', icon: LayoutDashboard, keywords: 'home overview alerts' },
  { label: 'Point of Sale', path: '/dashboard', icon: ShoppingCart, keywords: 'pos sell till checkout' },
  { label: 'Products & Inventory', path: '/inventory', icon: Package, keywords: 'stock items catalog sku' },
  { label: 'Customers', path: '/customers', icon: Users, keywords: 'crm clients debtors' },
  { label: 'Suppliers & Parties', path: '/parties', icon: Truck, keywords: 'vendors payables', enabled: FEATURES.parties },
  { label: 'Warehouse & Procurement', path: '/warehouse', icon: WarehouseIcon, keywords: 'purchase orders grn', enabled: FEATURES.warehouse },
  { label: 'Smart Inventory', path: '/smart-inventory', icon: Package, keywords: 'forecast reorder dead stock', enabled: FEATURES.smartInventory },
  { label: 'Promotions', path: '/promotions', icon: Percent, keywords: 'discount bogo offers', enabled: FEATURES.promotions },
  { label: 'Reports & Transactions', path: '/reports', icon: BarChart3, keywords: 'sales history receipts refunds' },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, keywords: 'insights charts profit' },
  { label: 'Debts & Recovery', path: '/debts', icon: Wallet, keywords: 'credit aging legal' },
  { label: 'Branches', path: '/branches', icon: Building2, keywords: 'stores locations' },
  { label: 'Settings', path: '/settings', icon: Settings, keywords: 'preferences tax receipt printer staff' },
];

export const pushRecentRoute = (path: string, label: string) => {
  try {
    const prev: { path: string; label: string }[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const next = [{ path, label }, ...prev.filter(r => r.path !== path)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recents are best-effort */
  }
};

const readRecents = (): { path: string; label: string }[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Global fuzzy command palette — Ctrl/Cmd + K on desktop, app-bar button on mobile. */
const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const navigate = useNavigate();
  const { currentBusiness } = useBusiness();
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 250);
  const term = debounced.trim();

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const recents = useMemo(() => (open ? readRecents() : []), [open]);
  const navItems = useMemo(() => NAV_COMMANDS.filter(c => c.enabled !== false), []);

  const { data: results } = useQuery({
    queryKey: ['palette', currentBusiness?.id, term],
    enabled: open && term.length >= 2 && !!currentBusiness?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const like = `%${term}%`;
      const [products, customers, parties] = await Promise.all([
        supabase
          .from('products')
          .select('id,name,sku')
          .eq('business_id', currentBusiness!.id)
          .or(`name.ilike.${like},sku.ilike.${like}`)
          .limit(5),
        supabase
          .from('customers')
          .select('id,name,phone')
          .eq('business_id', currentBusiness!.id)
          .or(`name.ilike.${like},phone.ilike.${like}`)
          .limit(5),
        supabase
          .from('parties')
          .select('id,name,party_type')
          .eq('business_id', currentBusiness!.id)
          .ilike('name', like)
          .limit(5),
      ]);
      return {
        products: products.data ?? [],
        customers: customers.data ?? [],
        parties: parties.data ?? [],
      };
    },
  });

  const go = (path: string, label: string) => {
    pushRecentRoute(path, label);
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search pages, products, customers, suppliers…"
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>No matches found.</CommandEmpty>

        {!term && recents.length > 0 && (
          <CommandGroup heading="Recent">
            {recents.map(r => (
              <CommandItem key={r.path} value={`recent ${r.label}`} onSelect={() => go(r.path, r.label)}>
                <Clock className="mr-2 opacity-60" />
                {r.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Navigate">
          {navItems.map(item => (
            <CommandItem
              key={item.path}
              value={`${item.label} ${item.keywords ?? ''}`}
              onSelect={() => go(item.path, item.label)}
            >
              <item.icon className="mr-2 opacity-70" />
              {item.label}
              <CommandShortcut>{item.path}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        {!!results?.products.length && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Products">
              {results.products.map(p => (
                <CommandItem
                  key={p.id}
                  value={`product ${p.name} ${p.sku ?? ''}`}
                  onSelect={() => go(`/inventory?product=${p.id}`, 'Products & Inventory')}
                >
                  <Package className="mr-2 opacity-70" />
                  <span className="truncate">{p.name}</span>
                  {p.sku && <CommandShortcut>{p.sku}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {!!results?.customers.length && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Customers">
              {results.customers.map(c => (
                <CommandItem
                  key={c.id}
                  value={`customer ${c.name} ${c.phone ?? ''}`}
                  onSelect={() => go(`/customers?customer=${c.id}`, 'Customers')}
                >
                  <Users className="mr-2 opacity-70" />
                  <span className="truncate">{c.name}</span>
                  {c.phone && <CommandShortcut>{c.phone}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {!!results?.parties.length && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Suppliers & Parties">
              {results.parties.map(p => (
                <CommandItem
                  key={p.id}
                  value={`party ${p.name}`}
                  onSelect={() => go(`/parties?party=${p.id}`, 'Suppliers & Parties')}
                >
                  <Truck className="mr-2 opacity-70" />
                  <span className="truncate">{p.name}</span>
                  <CommandShortcut>{p.party_type}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;