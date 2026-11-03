import { NavLink, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  Users,
  Building2,
  Settings,
  Store,
  Truck,
  Wallet,
  Shield,
  LayoutDashboard,
  TrendingUp,
  Tag,
  Warehouse,
  PieChart,
  Activity,
  Receipt,
  Printer,
  User,
  KeyRound,
  Percent,
  CheckSquare,
  ArrowLeftRight,
  CreditCard,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { FEATURES } from '@/lib/feature-flags';
import { usePermissions } from '@/hooks/usePermissions';
import { canAccess } from '@/lib/nav-access';
import { useIsPlatformAdmin } from '@/hooks/usePricing';

type NavItem = { path: string; label: string; icon: typeof Store; enabled?: boolean };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Daily work',
    items: [
      { path: '/command-center', label: 'Home', icon: LayoutDashboard },
      { path: '/dashboard', label: 'Sell (POS)', icon: ShoppingCart },
      { path: '/inventory', label: 'Products', icon: Package },
      { path: '/customers', label: 'Customers', icon: Users },
      { path: '/debts', label: 'Payments & Debts', icon: Wallet },
    ],
  },
  {
    label: 'Insights',
    items: [
      { path: '/reports', label: 'Reports', icon: PieChart },
      { path: '/analytics', label: 'Sales Trends', icon: TrendingUp },
    ],
  },
  {
    label: 'Stock & suppliers',
    items: [
      { path: '/parties', label: 'Suppliers', icon: Truck, enabled: FEATURES.parties },
      { path: '/branches?tab=transfers', label: 'Transfers', icon: ArrowLeftRight },
      { path: '/warehouse', label: 'Warehouse & Orders', icon: Warehouse, enabled: FEATURES.warehouse },
      { path: '/smart-inventory', label: 'Reorder Advice', icon: TrendingUp, enabled: FEATURES.smartInventory },
      { path: '/promotions', label: 'Promotions', icon: Tag, enabled: FEATURES.promotions },
    ],
  },
  {
    label: 'Business setup',
    items: [
      { path: '/branches', label: 'Branches', icon: Building2 },
      { path: '/settings?tab=team', label: 'Staff & Roles', icon: Users },
      { path: '/settings?tab=receipts', label: 'Receipts', icon: Receipt },
      { path: '/settings?tab=printers', label: 'Printers', icon: Printer },
      { path: '/settings?tab=tax', label: 'Tax', icon: Percent },
      { path: '/settings?tab=approvals', label: 'Approvals', icon: CheckSquare },
      { path: '/subscription', label: 'Subscription', icon: CreditCard },
      { path: '/settings', label: 'All Settings', icon: Settings },
    ],
  },
  {
    label: 'Account',
    items: [
      { path: '/settings?tab=profile', label: 'My Profile', icon: User },
      { path: '/settings?tab=security', label: 'Security', icon: KeyRound },
      { path: '/audit-log', label: 'Activity Log', icon: Shield },
      { path: '/observability', label: 'System Health', icon: Activity },
    ],
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  const { pathname, search } = useLocation();
  const currentUrl = `${pathname}${search}`;
  const { permissions, isLoading, businessId } = usePermissions();
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const groups = isPlatformAdmin
    ? [...navGroups, { label: 'Platform admin', items: [{ path: '/admin/billing', label: 'Subscribers & Billing', icon: CreditCard }] }]
    : navGroups;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center px-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 shrink-0 bg-gradient-hero rounded-lg flex items-center justify-center shadow-soft">
            <Store className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-bold text-base tracking-tight truncate">DukaOS</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        {groups.map(group => {
          const items = group.items.filter(i => i.path === '/admin/billing' || (i.enabled !== false && !isLoading && !!businessId && canAccess(permissions, i.path)));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map(item => {
                    const Icon = item.icon;
                    const active = item.path.includes('?')
                      ? currentUrl === item.path
                      : pathname === item.path && (!search || !item.path.startsWith('/settings'));
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                          className="min-h-11 md:min-h-9"
                        >
                          <NavLink
                            to={item.path}
                            onClick={() => isMobile && setOpenMobile(false)}
                            className={cn('flex items-center gap-2.5')}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

export default AppSidebar;