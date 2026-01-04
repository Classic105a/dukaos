import { useState, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
  Store
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'POS', icon: ShoppingCart },
  { path: '/inventory', label: 'Inventory', icon: Package },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/branches', label: 'Branches', icon: Building2 },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { branches, currentBranch, setCurrentBranch } = useBranch();
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation - Professional header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between h-14 px-3 lg:px-4">
          {/* Left: Logo + Mobile Menu */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-hero rounded-lg flex items-center justify-center shadow-soft">
                <Store className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-base hidden sm:block">DukaOS</span>
            </Link>
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden lg:flex items-center bg-secondary rounded-lg p-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                    isActive 
                      ? 'bg-card text-foreground shadow-soft' 
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Status + Branch + User */}
          <div className="flex items-center gap-2">
            {/* Status Indicators - Combined */}
            <div className="flex items-center gap-1">
              {/* Sync Status */}
              {pendingCount > 0 && (
                <div className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
                  isSyncing ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'
                )}>
                  <RefreshCw className={cn('w-3 h-3', isSyncing && 'animate-spin')} />
                  <span>{pendingCount}</span>
                </div>
              )}
              
              {/* Online Status */}
              <div className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
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
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 px-2 sm:px-3">
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

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 h-8 px-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-2xs font-bold text-primary-foreground">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 opacity-50 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">Logged in</p>
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

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t border-border bg-card animate-fade-in">
            <div className="p-2 space-y-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === '/settings'
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <Settings className="w-5 h-5" />
                Settings
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-3 lg:p-4">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;