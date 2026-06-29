import { useEffect, useState } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SystemHealthBar = () => {
  const { isOnline, isSyncing, pendingCount, syncError, syncPendingSales, clearFailedSales } = useOfflineSync();
  const [dismissed, setDismissed] = useState(false);
  const [dbLatency, setDbLatency] = useState<number | null>(null);

  // Reset dismissed state when status changes
  useEffect(() => {
    if (!isOnline || syncError) setDismissed(false);
  }, [isOnline, syncError]);

  // Measure DB latency periodically
  useEffect(() => {
    if (!isOnline) return;
    const measure = async () => {
      const start = performance.now();
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.from('branches').select('id').limit(1).maybeSingle();
        setDbLatency(Math.round(performance.now() - start));
      } catch {
        setDbLatency(null);
      }
    };
    measure();
    const interval = setInterval(measure, 60000);
    return () => clearInterval(interval);
  }, [isOnline]);

  const showBar = !isOnline || syncError || isSyncing || pendingCount > 0;

  if (!showBar || dismissed) return null;

  const getStatus = () => {
    if (!isOnline) return { color: 'bg-destructive', icon: WifiOff, label: 'Offline — sales saved locally', type: 'error' as const };
    if (syncError) return { color: 'bg-destructive', icon: AlertTriangle, label: syncError, type: 'error' as const };
    if (isSyncing) return { color: 'bg-primary', icon: RefreshCw, label: 'Syncing pending transactions...', type: 'syncing' as const };
    if (pendingCount > 0) return { color: 'bg-warning', icon: Activity, label: `${pendingCount} transaction${pendingCount > 1 ? 's' : ''} pending sync`, type: 'warning' as const };
    return { color: 'bg-success', icon: CheckCircle2, label: 'All systems operational', type: 'ok' as const };
  };

  const status = getStatus();
  const Icon = status.icon;

  return (
    <div className={cn('overflow-hidden shrink-0', status.color)}>
      <div className="flex items-center justify-between px-3 py-1.5 text-white text-xs font-medium">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-3.5 h-3.5', status.type === 'syncing' && 'animate-spin')} />
          <span>{status.label}</span>
          {dbLatency !== null && isOnline && !syncError && (
            <span className="opacity-60 ml-2">
              {dbLatency}ms latency
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {pendingCount > 0 && isOnline && !isSyncing && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs text-white hover:text-white hover:bg-white/20 px-2"
              onClick={() => syncPendingSales()}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Sync Now
            </Button>
          )}
          {syncError && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs text-white hover:text-white hover:bg-white/20 px-2"
              onClick={clearFailedSales}
            >
              Clear Failed
            </Button>
          )}
          <button onClick={() => setDismissed(true)} className="p-0.5 hover:bg-white/20 rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthBar;
