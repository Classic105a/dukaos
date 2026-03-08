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
  Tag,
  TrendingUp,
  Warehouse,
  PieChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';

const primaryTabs = [
  { path: '/dashboard', label: 'POS', icon: ShoppingCart },
  { path: '/analytics', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/reports', label: 'Reports', icon: PieChart },
];

const moreGroups = [
  {
    label: 'Sales',
    items: [
      { path: '/promotions', label: 'Promotions', icon: Tag },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { path: '/smart-inventory', label: 'Forecasting', icon: TrendingUp },
      { path: '/warehouse', label: 'Warehouse & GRN', icon: Warehouse },
    ],
  },
  {
    label: 'Finance',
    items: [
      { path: '/customers', label: 'Customers', icon: Users },
      { path: '/parties', label: 'Suppliers', icon: Truck },
      { path: '/debts', label: 'Debts', icon: Wallet },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/branches', label: 'Branches', icon: Building2 },
      { path: '/audit-log', label: 'Audit Log', icon: Shield },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const allMorePaths = moreGroups.flatMap(g => g.items.map(i => i.path));

const BottomNav = () => {
  const location = useLocation();
  const isMoreActive = allMorePaths.includes(location.pathname);

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

        {/* More menu — grouped */}
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
          <DropdownMenuContent align="end" side="top" className="w-56 mb-2 max-h-[70vh] overflow-y-auto">
            {moreGroups.map((group, idx) => (
              <div key={group.label}>
                {idx > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-2">
                  {group.label}
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <DropdownMenuItem key={item.path} asChild>
                        <Link
                          to={item.path}
                          className={cn(
                            'flex items-center gap-2.5 cursor-pointer',
                            isActive && 'bg-primary/10 text-primary font-medium'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};

export default BottomNav;
