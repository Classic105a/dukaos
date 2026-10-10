import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/layout/AppSidebar';
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
  Building2,
  Settings,
  LogOut,
  ChevronDown,
  Wifi,
  WifiOff,
  RefreshCw,
  Store,
} from 'lucide-react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import BusinessSwitcher from '@/components/layout/BusinessSwitcher';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { branches, currentBranch, setCurrentBranch } = useBranch();
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();
  const { open: openPalette } = useCommandPalette();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background flex">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
      <SystemHealthBar />

      {/* Top Navigation */}
      <header className="shrink-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between h-14 px-3 lg:px-5">
          {/* Left: Logo */}
          <div className="flex items-center gap-2 min-w-0">
            <SidebarTrigger className="shrink-0" />
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-hero rounded-lg flex items-center justify-center shadow-soft lg:hidden">
                <Store className="w-4 h-4 text-primary-foreground" />
              </div>
            </Link>
            <div className="hidden sm:block">
              <BusinessSwitcher />
            </div>
          </div>

          {/* Right: Status + Branch + User */}
          <div className="flex items-center gap-1.5">
            {/* Global command palette */}
            <Button
              variant="outline"
              size="sm"
              onClick={openPalette}
              aria-label="Search and commands"
              className="h-8 gap-2 px-2 sm:px-3 rounded-lg text-muted-foreground"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-xs">Search…</span>
              <kbd className="hidden lg:inline text-2xs bg-muted px-1.5 py-0.5 rounded border border-border">
                ⌘K
              </kbd>
            </Button>

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
      <main className="flex-1 p-3 lg:p-5 min-w-0 pb-24 md:pb-5">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
      <MobileBottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
