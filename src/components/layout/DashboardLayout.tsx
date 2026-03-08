import { useState, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/layout/BottomNav';
import SystemHealthBar from '@/components/SystemHealthBar';
import PageTransition from '@/components/PageTransition';
import { useBranch } from '@/hooks/useBranch';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Users, 
  Building2, 
  Settings, 
  LogOut,
  Menu,
  X,
  ChevronDown,
  Wifi,
  WifiOff,
  RefreshCw,
  Store,
  Truck,
  Wallet,
  Shield,
  LayoutDashboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import BusinessSwitcher from '@/components/layout/BusinessSwitcher';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'POS', icon: ShoppingCart },
  { path: '/analytics', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/smart-inventory', label: 'Forecasting', icon: BarChart3 },
  { path: '/warehouse', label: 'Warehouse', icon: Truck },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/promotions', label: 'Promos', icon: Store },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/parties', label: 'Parties', icon: Truck },
  { path: '/debts', label: 'Debts', icon: Wallet },
  { path: '/audit-log', label: 'Audit', icon: Shield },
  { path: '/branches', label: 'Branches', icon: Building2 },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { branches, currentBranch, setCurrentBranch } = useBranch();
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();
  const [mobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* System Health Bar */}
      <SystemHealthBar />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-14 px-3 lg:px-5">
          {/* Left: Logo + Mobile Menu */}
          <div className="flex items-center gap-2.5">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-hero rounded-lg flex items-center justify-center shadow-soft">
                <Store className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-base hidden sm:block">DukaOS</span>
            </Link>
            <div className="hidden sm:block">
              <BusinessSwitcher />
            </div>
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden lg:flex items-center bg-secondary/70 rounded-xl p-1 gap-0.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive 
                      ? 'bg-card text-foreground shadow-soft' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Status + Branch + User */}
          <div className="flex items-center gap-1.5">
            {/* Status Indicators */}
            <div className="flex items-center gap-1">
              {pendingCount > 0 && (
                <div className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
                  isSyncing ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                )}>
                  <RefreshCw className={cn('w-3 h-3', isSyncing && 'animate-spin')} />
                  <span>{pendingCount}</span>
                </div>
              )}
              
              <div className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
                isOnline 
                  ? 'bg-success/10 text-success' 
                  : 'bg-warning/10 text-warning'
              )}>
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>

            {/* Branch Selector */}
            {branches.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg">
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline max-w-[80px] truncate text-xs">
                      {currentBranch?.name || 'Branch'}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {branches.map(branch => (
                    <DropdownMenuItem
                      key={branch.id}
                      onClick={() => setCurrentBranch(branch)}
                      className={cn(
                        'text-sm',
                        currentBranch?.id === branch.id && 'bg-primary/10 text-primary font-medium'
                      )}
                    >
                      {branch.name}
                      {branch.is_headquarters && (
                        <span className="ml-auto text-2xs bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">HQ</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <ThemeToggle />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 h-8 px-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-hero flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-foreground">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 opacity-50 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2.5 border-b border-border">
                  <p className="text-sm font-semibold truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Logged in</p>
                </div>
                <DropdownMenuItem onClick={() => navigate('/settings')} className="text-sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive text-sm">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

      </header>

      {/* Main Content */}
      <main className="flex-1 p-3 lg:p-5 pb-bottom-nav lg:pb-5">
        <PageTransition>
          {children}
        </PageTransition>
      </main>

      {/* Bottom Navigation — Mobile */}
      <BottomNav />
    </div>
  );
};

export default DashboardLayout;