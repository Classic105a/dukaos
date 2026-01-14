import { useState, useEffect, ReactNode } from 'react';
import { useBranch } from '@/hooks/useBranch';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Menu, 
  RotateCcw, 
  Printer, 
  Settings, 
  LogOut, 
  Store, 
  Wifi, 
  WifiOff,
  User,
  ChevronDown,
  PauseCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface POSHeaderProps {
  heldSalesCount: number;
  onReturnClick: () => void;
  onReprintClick: () => void;
  heldSalesPanel: ReactNode;
}

const POSHeader = ({ 
  heldSalesCount, 
  onReturnClick, 
  onReprintClick,
  heldSalesPanel 
}: POSHeaderProps) => {
  const { currentBranch, branches, setCurrentBranch } = useBranch();
  const { user, signOut } = useAuth();
  const { isOnline, pendingSales } = useOfflineSync();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="flex items-center justify-between h-14 px-3 lg:px-4">
        {/* Left: Menu & Brand */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/inventory" className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Inventory
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/customers" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customers
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/reports" className="flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Reports
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground leading-tight">DukaOS</span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {format(currentTime, 'h:mm a')}
            </span>
          </div>
        </div>

        {/* Center: Branch Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 max-w-[160px]">
              <Store className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate text-xs font-medium">
                {currentBranch?.name || 'Select Branch'}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48">
            {branches?.map((branch) => (
              <DropdownMenuItem
                key={branch.id}
                onClick={() => setCurrentBranch(branch)}
                className={currentBranch?.id === branch.id ? 'bg-primary/10' : ''}
              >
                <Store className="h-4 w-4 mr-2" />
                {branch.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Right: Actions & Status */}
        <div className="flex items-center gap-1">
          {/* Network Status */}
          <div className="flex items-center gap-1 mr-1">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <div className="flex items-center gap-1">
                <WifiOff className="h-4 w-4 text-destructive" />
                {pendingSales.length > 0 && (
                  <Badge variant="destructive" className="h-5 text-[10px] px-1.5">
                    {pendingSales.length}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions - Desktop */}
          <div className="hidden md:flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs gap-1"
              onClick={onReturnClick}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Returns</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs gap-1"
              onClick={onReprintClick}
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Reprint</span>
            </Button>
          </div>

          {/* Held Sales */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                <PauseCircle className="h-5 w-5" />
                {heldSalesCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {heldSalesCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              {heldSalesPanel}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onReturnClick}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Returns
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onReprintClick}>
                <Printer className="h-4 w-4 mr-2" />
                Reprint Receipt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default POSHeader;
