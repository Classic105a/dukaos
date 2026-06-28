import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, LayoutGrid } from 'lucide-react';
import { FEATURES, type FeatureKey } from '@/lib/feature-flags';
import { cn } from '@/lib/utils';

interface ModuleRow {
  key: FeatureKey;
  label: string;
  envVar: string;
  description: string;
  /** Roles that can see this module's nav entries when the flag is on. */
  roles: string[];
}

const MODULES: ModuleRow[] = [
  { key: 'warehouse',      label: 'Warehouse & GRNs', envVar: 'VITE_FEATURE_WAREHOUSE',       description: 'Purchase orders, goods received notes, batch & expiry tracking.', roles: ['owner', 'admin', 'manager'] },
  { key: 'smartInventory', label: 'Smart Forecasting', envVar: 'VITE_FEATURE_SMART_INVENTORY', description: '30-day velocity, dead stock, reorder suggestions.',                  roles: ['owner', 'admin', 'manager'] },
  { key: 'promotions',     label: 'Promotions Engine', envVar: 'VITE_FEATURE_PROMOTIONS',      description: 'Time-bound discounts, BOGO, bulk pricing.',                         roles: ['owner', 'admin', 'manager'] },
  { key: 'parties',        label: 'Suppliers (Parties)', envVar: 'VITE_FEATURE_PARTIES',       description: 'B2B parties module and payables ledgers.',                          roles: ['owner', 'admin', 'manager'] },
  { key: 'installments',   label: 'Installment Plans', envVar: 'VITE_FEATURE_INSTALLMENTS',    description: 'Customer installment scheduling and tracking.',                     roles: ['owner', 'admin', 'manager'] },
  { key: 'legalCases',     label: 'Legal Cases', envVar: 'VITE_FEATURE_LEGAL_CASES',           description: 'Small claims court tracker for unrecovered debt.',                  roles: ['owner', 'admin'] },
];

interface Props {
  currentRole?: string | null;
}

const ModulesSettings = ({ currentRole }: Props) => {
  const role = (currentRole || '').toLowerCase();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" />
          <CardTitle>Modules</CardTitle>
        </div>
        <CardDescription>
          Controlled by <code className="px-1 py-0.5 rounded bg-muted text-xs">VITE_FEATURE_*</code> build-time
          flags. Flip to <code>0</code> in <code>.env</code> and rebuild to hide a module entirely.
          The right column shows whether your current role would see it when enabled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {MODULES.map((m) => {
            const enabled = FEATURES[m.key];
            const visibleToRole = role ? m.roles.includes(role) : false;
            return (
              <div
                key={m.key}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-lg border border-border bg-card/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{m.label}</p>
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{m.envVar}</code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Roles: {m.roles.map(r => <span key={r} className="mr-1">{r}</span>)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={enabled ? 'default' : 'secondary'} className={cn(enabled ? '' : 'opacity-60')}>
                    {enabled ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                    {enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      enabled && visibleToRole && 'border-success text-success',
                      enabled && !visibleToRole && 'border-warning text-warning',
                      !enabled && 'opacity-50'
                    )}
                  >
                    {enabled
                      ? visibleToRole
                        ? `Visible to you (${role || 'unknown'})`
                        : `Hidden from you (${role || 'unknown'})`
                      : 'Hidden globally'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
          <p><strong>How to change:</strong> set the env var in your deployment (e.g. <code>VITE_FEATURE_WAREHOUSE=0</code>) and rebuild.</p>
          <p>Routes for disabled modules redirect to <code>/more</code>, and their tiles are removed from navigation.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModulesSettings;