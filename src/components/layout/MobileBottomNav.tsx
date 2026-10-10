import { NavLink, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Package, Users, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { canAccess } from '@/lib/nav-access';

const items = [
  { path: '/command-center', label: 'Home', icon: Home },
  { path: '/dashboard', label: 'Sell', icon: ShoppingCart },
  { path: '/inventory', label: 'Products', icon: Package },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/more', label: 'More', icon: LayoutGrid },
];

/** Thumb-friendly bar for the most-used pages on phones. Items follow the user's role. */
export function MobileBottomNav() {
  const { pathname } = useLocation();
  const { permissions, isLoading, businessId } = usePermissions();
  if (isLoading || !businessId) return null;
  const visible = items.filter(i => i.path === '/more' || canAccess(permissions, i.path));

  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {visible.map(({ path, label, icon: Icon }) => {
          const active = pathname === path;
          return (
            <li key={path} className="flex-1">
              <NavLink
                to={path}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default MobileBottomNav;
