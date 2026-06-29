import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  LayoutDashboard,
  MoreHorizontal,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const primaryTabs = [
  { path: '/dashboard', label: 'POS', icon: ShoppingCart },
  { path: '/analytics', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inventory', label: 'Products', icon: Package },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/more', label: 'More', icon: MoreHorizontal },
];

const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="lg:hidden sticky bottom-0 left-0 right-0 z-50 shrink-0 bg-card border-t border-border safe-area-bottom shadow-[0_-1px_0_hsl(var(--border))]">
      <div className="flex items-stretch justify-around h-16 px-1">
        {primaryTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 transition-colors duration-150',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn(
                'flex items-center justify-center w-10 h-7 rounded-lg transition-all duration-200',
                isActive && 'bg-primary/10'
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold leading-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
