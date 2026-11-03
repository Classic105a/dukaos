import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Lock, ArrowUpRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useSubscription, SubscriptionStatus } from '@/hooks/useSubscription';

/** Entities whose creation/modification is blocked while a subscription is expired. */
export type WriteScope =
  | 'sales' | 'purchases' | 'expenses' | 'products' | 'customers'
  | 'suppliers' | 'employees' | 'branches' | 'warehouses' | 'modules';

interface GateValue {
  status: SubscriptionStatus;
  isReadOnly: boolean;
  daysRemaining: number | null;
  /** False when writes to this scope are blocked by the subscription state. */
  canWrite: (scope: WriteScope) => boolean;
  /** Explanation shown in tooltips / disabled states. */
  blockedReason: (scope: WriteScope) => string | null;
  /** Guard for event handlers: returns false and explains when blocked. */
  requireWrite: (scope: WriteScope) => boolean;
}

const SubscriptionGateContext = createContext<GateValue | null>(null);

const READ_ONLY_MESSAGE =
  'Your subscription has expired. Creating and editing records is disabled until you renew — reports, dashboards and settings stay available.';

export const SubscriptionGate = ({ children }: { children: ReactNode }) => {
  const { status, isReadOnly, daysRemaining } = useSubscription();

  const value = useMemo<GateValue>(() => {
    const canWrite = () => !isReadOnly;
    return {
      status,
      isReadOnly,
      daysRemaining,
      canWrite,
      blockedReason: () => (isReadOnly ? READ_ONLY_MESSAGE : null),
      requireWrite: () => {
        if (isReadOnly) {
          toast.error('Subscription expired', { description: READ_ONLY_MESSAGE });
          return false;
        }
        return true;
      },
    };
  }, [status, isReadOnly, daysRemaining]);

  return (
    <SubscriptionGateContext.Provider value={value}>
      <SubscriptionBanner />
      {children}
    </SubscriptionGateContext.Provider>
  );
};

export const useSubscriptionGate = (): GateValue => {
  const ctx = useContext(SubscriptionGateContext);
  if (!ctx) {
    // Safe default outside the gate (e.g. public routes): never block.
    return {
      status: 'active',
      isReadOnly: false,
      daysRemaining: null,
      canWrite: () => true,
      blockedReason: () => null,
      requireWrite: () => true,
    };
  }
  return ctx;
};

/** Persistent, dismissible-per-session status banner for trial/grace/expired. */
const SubscriptionBanner = () => {
  const { status, daysRemaining } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const onBillingPage = location.pathname.startsWith('/subscription');
  const showTrialNotice = status === 'trialing' && (daysRemaining ?? 99) <= 14;
  const critical = status === 'grace' || status === 'expired' || status === 'cancelled';

  const onSellScreen = location.pathname.startsWith('/dashboard');
  const dismissible = !critical || onSellScreen;

  if (onBillingPage || (!critical && !showTrialNotice)) return null;
  if (dismissed && dismissible) return null;

  const config = {
    grace: {
      icon: AlertTriangle,
      tone: 'bg-warning/10 text-warning-foreground border-warning/30',
      text: 'Your subscription lapsed and you are in the grace period. Renew now to keep full access.',
    },
    expired: {
      icon: Lock,
      tone: 'bg-destructive/10 text-destructive border-destructive/30',
      text: READ_ONLY_MESSAGE,
    },
    cancelled: {
      icon: Lock,
      tone: 'bg-destructive/10 text-destructive border-destructive/30',
      text: 'Your subscription was cancelled. The app is read-only until you resubscribe.',
    },
    trialing: {
      icon: Clock,
      tone: 'bg-primary/10 text-foreground border-primary/30',
      text: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in your free trial.`,
    },
  }[critical ? status : 'trialing'] ?? null;

  if (!config) return null;
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-2 border-b px-3 py-2 text-xs sm:text-sm ${config.tone}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <p className="flex-1 min-w-0 break-words">{config.text}</p>
      <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={() => navigate('/subscription')}>
        Renew <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
      </Button>
      {!critical && (
        <button aria-label="Dismiss" className="shrink-0 p-1" onClick={() => setDismissed(true)}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default SubscriptionGate;
