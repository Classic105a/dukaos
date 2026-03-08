import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  ShoppingCart,
  LayoutDashboard,
  Tag,
  Package,
  TrendingUp,
  Warehouse,
  PieChart,
  FileText,
  Users,
  Truck,
  Wallet,
  Building2,
  Shield,
  Settings,
  ChevronRight,
  Store,
  RotateCcw,
  User,
  Key,
  Receipt,
  Printer,
  Calculator,
  Palette,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavBoxItem {
  path: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

interface NavGroup {
  label: string;
  items: NavBoxItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Sales',
    items: [
      { path: '/dashboard', label: 'Point of Sale', icon: ShoppingCart, color: 'text-primary', bg: 'bg-primary/10' },
      { path: '/analytics', label: 'Dashboard', icon: LayoutDashboard, color: 'text-info', bg: 'bg-info/10' },
      { path: '/promotions', label: 'Promotions', icon: Tag, color: 'text-accent', bg: 'bg-accent/10' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { path: '/inventory', label: 'Products', icon: Package, color: 'text-primary', bg: 'bg-primary/10' },
      { path: '/smart-inventory', label: 'Forecasting', icon: TrendingUp, color: 'text-accent', bg: 'bg-accent/10' },
      { path: '/warehouse', label: 'Warehouse', icon: Warehouse, color: 'text-warning', bg: 'bg-warning/10' },
      { path: '/warehouse', label: 'Purchase Orders', icon: FileText, color: 'text-info', bg: 'bg-info/10' },
      { path: '/dashboard', label: 'Returns', icon: RotateCcw, color: 'text-destructive', bg: 'bg-destructive/10' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { path: '/reports', label: 'Reports', icon: PieChart, color: 'text-primary', bg: 'bg-primary/10' },
      { path: '/customers', label: 'Customers', icon: Users, color: 'text-info', bg: 'bg-info/10' },
      { path: '/parties', label: 'Suppliers', icon: Truck, color: 'text-accent', bg: 'bg-accent/10' },
      { path: '/debts', label: 'Credit / Debt', icon: Wallet, color: 'text-destructive', bg: 'bg-destructive/10' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { path: '/settings?tab=profile', label: 'Profile', icon: User, color: 'text-primary', bg: 'bg-primary/10' },
      { path: '/settings?tab=security', label: 'Security', icon: Key, color: 'text-warning', bg: 'bg-warning/10' },
      { path: '/settings?tab=team', label: 'Team', icon: UserCog, color: 'text-info', bg: 'bg-info/10' },
      { path: '/settings?tab=approvals', label: 'Approvals', icon: Shield, color: 'text-destructive', bg: 'bg-destructive/10' },
      { path: '/settings?tab=receipts', label: 'Receipts', icon: Receipt, color: 'text-accent', bg: 'bg-accent/10' },
      { path: '/settings?tab=printers', label: 'Printers', icon: Printer, color: 'text-primary', bg: 'bg-primary/10' },
      { path: '/settings?tab=tax', label: 'Tax', icon: Calculator, color: 'text-warning', bg: 'bg-warning/10' },
      { path: '/settings?tab=preferences', label: 'Preferences', icon: Palette, color: 'text-muted-foreground', bg: 'bg-muted' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/branches', label: 'Branches', icon: Building2, color: 'text-primary', bg: 'bg-primary/10' },
      { path: '/audit-log', label: 'Audit Log', icon: Shield, color: 'text-warning', bg: 'bg-warning/10' },
    ],
  },
];

const More = () => {
  const { user } = useAuth();
  const { currentBranch, branches } = useBranch();

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">More</h1>
          <p className="text-sm text-muted-foreground">All modules & settings</p>
        </div>

        {/* User Card */}
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3 shadow-soft">
          <div className="w-11 h-11 rounded-full bg-gradient-hero flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-primary-foreground">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground">Owner</p>
          </div>
          <span className="text-xs font-semibold text-accent bg-accent/10 px-2.5 py-1 rounded-full uppercase tracking-wide">
            Owner
          </span>
        </div>

        {/* Branches */}
        {branches.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Your Branches
            </h2>
            <div className="bg-card rounded-2xl border border-border divide-y divide-border shadow-soft overflow-hidden">
              {branches.map(branch => (
                <Link
                  key={branch.id}
                  to="/branches"
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Store className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{branch.name}</p>
                    <p className="text-xs text-muted-foreground">{branch.city || branch.location || 'No location'}</p>
                  </div>
                  {branch.is_headquarters && (
                    <span className="text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                      Main
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Grouped Navigation Boxes */}
        {navGroups.map(group => (
          <div key={group.label} className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {group.label}
            </h2>
            <div className="grid grid-cols-4 gap-2.5">
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path + item.label}
                    to={item.path}
                    className="flex flex-col items-center gap-2 p-3.5 bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-soft transition-all duration-200 group"
                  >
                    <div className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110',
                      item.bg
                    )}>
                      <Icon className={cn('w-5 h-5', item.color)} />
                    </div>
                    <span className="text-[11px] font-medium text-foreground text-center leading-tight">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default More;
