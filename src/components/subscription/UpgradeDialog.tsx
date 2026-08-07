import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Surface, StatusBadge, money } from '@/components/ds';
import { ArrowUpRight, Check, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlans, useSubscription } from '@/hooks/useSubscription';
import { usePlanPrices } from '@/hooks/usePricing';
import { LimitKey, useUsage } from '@/hooks/useUsage';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The limit that triggered this dialog, when relevant. */
  limitKey?: LimitKey;
  /** Feature name when the block is feature-based rather than limit-based. */
  feature?: string;
  reason?: string;
}

/**
 * Single reusable upgrade surface. Every limit or feature block in the app must
 * route through this dialog — never build a bespoke upsell.
 */
export const UpgradeDialog = ({ open, onOpenChange, limitKey, feature, reason }: UpgradeDialogProps) => {
  const navigate = useNavigate();
  const { plan } = useSubscription();
  const { data: plans = [] } = usePlans();
  const { data: prices } = usePlanPrices();
  const { usageFor } = useUsage();

  const usage = limitKey ? usageFor(limitKey) : null;
  const current = plans.find(p => p.id === plan?.id);

  // Recommend the cheapest plan that raises the blocking limit (or the next tier).
  const recommended =
    plans
      .filter(p => p.sort_order > (current?.sort_order ?? -1))
      .find(p => {
        if (!limitKey) return true;
        const max = (p as any)[`max_${limitKey}`];
        return max === null || (usage && max > usage.used);
      }) ?? plans.find(p => p.sort_order > (current?.sort_order ?? -1));

  const priceOf = (planId?: string) => {
    const row = planId ? prices?.get(planId) : undefined;
    return Number(row?.price_monthly ?? plans.find(p => p.id === planId)?.price_monthly ?? 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary shrink-0" />
            {limitKey ? `${usage?.label} limit reached` : 'Upgrade required'}
          </DialogTitle>
          <DialogDescription className="break-words">
            {reason ??
              (limitKey
                ? `Your ${current?.name ?? 'current'} plan allows ${usage?.allowed} ${usage?.label.toLowerCase()}.`
                : `${feature ?? 'This feature'} is not included in your ${current?.name ?? 'current'} plan.`)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {usage && (
            <Surface elevation="flat" className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Current usage</p>
                <p className="text-sm font-semibold">
                  {usage.used} / {usage.allowed ?? 'Unlimited'} {usage.label.toLowerCase()}
                </p>
              </div>
              <StatusBadge tone="warning">At limit</StatusBadge>
            </Surface>
          )}

          {recommended && (
            <Surface tone="primary" elevation="flat" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate">{recommended.name}</span>
                <span className="text-sm font-bold shrink-0">{money(priceOf(recommended.id))}/mo</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{recommended.max_branches ?? 'Unlimited'} branches</li>
                <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{recommended.max_employees ?? 'Unlimited'} team members</li>
                <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{recommended.max_products ?? 'Unlimited'} products</li>
                <li className="flex gap-1.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{recommended.support_level} support</li>
              </ul>
            </Surface>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Not now</Button>
          <Button onClick={() => { onOpenChange(false); navigate('/subscription'); }}>
            View plans <ArrowUpRight className="w-4 h-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeDialog;
