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

type NavItem = { path: string; label: string; icon: typeof Store; enabled?: boolean };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { path: '/command-center', label: 'Command Center', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Sales',
    items: [
      { path: '/dashboard', label: 'Point of Sale', icon: ShoppingCart },
      { path: '/analytics', label: 'Analytics', icon: PieChart },
      { path: '/promotions', label: 'Promotions', icon: Tag, enabled: FEATURES.promotions },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { path: '/inventory', label: 'Products', icon: Package },
      { path: '/branches?tab=transfers', label: 'Transfers', icon: ArrowLeftRight },
      { path: '/smart-inventory', label: 'Forecasting', icon: TrendingUp, enabled: FEATURES.smartInventory },
      { path: '/warehouse', label: 'Warehouse & GRN', icon: Warehouse, enabled: FEATURES.warehouse },
    ],
  },
  {
    label: 'Finance',
    items: [
      { path: '/reports', label: 'Reports', icon: PieChart },
      { path: '/customers', label: 'Customers', icon: Users },
      { path: '/parties', label: 'Suppliers', icon: Truck, enabled: FEATURES.parties },
      { path: '/debts', label: 'Debts', icon: Wallet },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/branches', label: 'Branches', icon: Building2 },
      { path: '/settings?tab=team', label: 'Team & Roles', icon: Users },
      { path: '/settings?tab=receipts', label: 'Receipts', icon: Receipt },
      { path: '/settings?tab=printers', label: 'Printers', icon: Printer },
      { path: '/settings?tab=tax', label: 'Tax', icon: Percent },
      { path: '/settings?tab=approvals', label: 'Approvals', icon: CheckSquare },
      { path: '/settings?tab=profile', label: 'Profile', icon: User },
      { path: '/settings?tab=security', label: 'Security', icon: KeyRound },
      { path: '/audit-log', label: 'Audit Log', icon: Shield },
      { path: '/observability', label: 'System Health', icon: Activity },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  const { pathname, search } = useLocation();
  const currentUrl = `${pathname}${search}`;

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
        {navGroups.map(group => {
          const items = group.items.filter(i => i.enabled !== false);
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