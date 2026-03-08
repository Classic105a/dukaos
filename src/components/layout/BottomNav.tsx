import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  LayoutDashboard,
  MoreHorizontal,
  Truck,
  Wallet,
  Shield,
  Building2,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const primaryTabs = [
  { path: '/dashboard', label: 'POS', icon: ShoppingCart },
  { path: '/analytics', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
];

const moreTabs = [
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/parties', label: 'Parties', icon: Truck },
  { path: '/debts', label: 'Debts', icon: Wallet },
  { path: '/audit-log', label: 'Audit', icon: Shield },
  { path: '/branches', label: 'Branches', icon: Building2 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const BottomNav = () => {
  const location = useLocation();
  const isMoreActive = moreTabs.some(t => location.pathname === t.path);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
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
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
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

        {/* More menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 transition-colors duration-150 outline-none',
                isMoreActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn(
                'flex items-center justify-center w-10 h-7 rounded-lg transition-all duration-200',
                isMoreActive && 'bg-primary/10'
              )}>
                <MoreHorizontal className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold leading-tight">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52 mb-2">
            {moreTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = location.pathname === tab.path;
              return (
                <DropdownMenuItem key={tab.path} asChild>
                  <Link
                    to={tab.path}
                    className={cn(
                      'flex items-center gap-2.5',
                      isActive && 'bg-primary/10 text-primary font-medium'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};

export default BottomNav;
