import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ApprovalRule {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  threshold?: number;
}

const DEFAULT_RULES: ApprovalRule[] = [
  {
    id: 'withdrawal_threshold',
    label: 'Withdrawal Approval',
    description: 'Require manager approval for withdrawals above threshold',
    enabled: false,
    threshold: 2000,
  },
  {
    id: 'discount_threshold',
    label: 'Discount Approval',
    description: 'Require approval for discounts above percentage',
    enabled: false,
    threshold: 10,
  },
  {
    id: 'void_sale',
    label: 'Void Sale Approval',
    description: 'Require manager approval to void any completed sale',
    enabled: true,
  },
  {
    id: 'price_override',
    label: 'Price Override Approval',
    description: 'Require approval when changing item price at checkout',
    enabled: false,
  },
  {
    id: 'refund_approval',
    label: 'Refund Approval',
    description: 'Require manager approval for all refunds/returns',
    enabled: true,
  },
  {
    id: 'credit_sale',
    label: 'Credit Sale Approval',
    description: 'Require approval for credit sales above threshold',
    enabled: false,
    threshold: 5000,
  },
];

const ApprovalSettings = () => {
  const [rules, setRules] = useState<ApprovalRule[]>(() => {
    const saved = localStorage.getItem('approval_rules');
    return saved ? JSON.parse(saved) : DEFAULT_RULES;
  });

  const handleToggle = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const handleThreshold = (id: string, value: number) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, threshold: value } : r));
  };

  const handleSave = () => {
    localStorage.setItem('approval_rules', JSON.stringify(rules));
    toast.success('Approval rules saved');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Owner's Gate — Approval Rules
        </CardTitle>
        <CardDescription>
          Set minimum thresholds that require manager/owner approval before proceeding
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rules.map(rule => (
          <div key={rule.id} className="flex items-start gap-4 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <Switch
              checked={rule.enabled}
              onCheckedChange={() => handleToggle(rule.id)}
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{rule.label}</p>
                {rule.enabled && (
                  <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{rule.description}</p>
              {rule.threshold !== undefined && rule.enabled && (
                <div className="flex items-center gap-2 mt-2">
                  <Label className="text-xs shrink-0">
                    {rule.id.includes('discount') ? 'Max %' : 'KES Threshold'}
                  </Label>
                  <Input
                    type="number"
                    value={rule.threshold}
                    onChange={e => handleThreshold(rule.id, parseFloat(e.target.value) || 0)}
                    className="h-8 w-32 text-sm"
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        <Button onClick={handleSave} className="w-full sm:w-auto">
          Save Approval Rules
        </Button>
      </CardContent>
    </Card>
  );
};

export default ApprovalSettings;
