import { useOfflineSync } from '@/hooks/useOfflineSync';
import { WifiOff, RefreshCw, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NetworkStatusProps {
  showRetry?: boolean;
  className?: string;
}

const NetworkStatus = ({ showRetry = true, className }: NetworkStatusProps) => {
  const { isOnline, isSyncing, pendingCount, syncPendingSales } = useOfflineSync();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {!isOnline ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive rounded-full text-sm">
          <WifiOff className="w-4 h-4" />
          <span className="font-medium">Offline</span>
        </div>
      ) : isSyncing ? (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 text-warning rounded-full text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="font-medium">Syncing...</span>
        </div>
      ) : pendingCount > 0 ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 text-warning rounded-full text-sm">
            <CloudOff className="w-4 h-4" />
            <span className="font-medium">{pendingCount} pending</span>
          </div>
          {showRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncPendingSales()}
              className="h-7"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Sync
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default NetworkStatus;
