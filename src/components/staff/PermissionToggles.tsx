import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCustomPermissions, PERMISSION_GROUPS, CustomPermission } from '@/hooks/useCustomPermissions';
import { ShoppingCart, Package, Wallet, Settings, Shield } from 'lucide-react';

interface PermissionTogglesProps {
  userId: string;
  userName?: string;
  userRole?: string;
}

const groupIcons: Record<string, React.ReactNode> = {
  sales: <ShoppingCart className="w-4 h-4" />,
  inventory: <Package className="w-4 h-4" />,
  finance: <Wallet className="w-4 h-4" />,
  system: <Settings className="w-4 h-4" />,
};

const PermissionToggles = ({ userId, userName, userRole }: PermissionTogglesProps) => {
  const { permissions, updatePermissions } = useCustomPermissions(userId);
  const [localPerms, setLocalPerms] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (permissions) {
      const perms: Record<string, boolean> = {};
      Object.entries(PERMISSION_GROUPS).forEach(([, group]) => {
        group.permissions.forEach(p => {
          perms[p.key] = (permissions as any)[p.key] ?? false;
        });
      });
      setLocalPerms(perms);
    }
  }, [permissions]);

  const handleToggle = (key: string, value: boolean) => {
    setLocalPerms(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    updatePermissions.mutate({ user_id: userId, ...localPerms } as any, {
      onSuccess: () => setIsDirty(false),
    });
  };

  const handleSelectAll = () => {
    const allTrue: Record<string, boolean> = {};
    Object.values(PERMISSION_GROUPS).forEach(group => {
      group.permissions.forEach(p => { allTrue[p.key] = true; });
    });
    setLocalPerms(allTrue);
    setIsDirty(true);
  };

  const handleClearAll = () => {
    const allFalse: Record<string, boolean> = {};
    Object.values(PERMISSION_GROUPS).forEach(group => {
      group.permissions.forEach(p => { allFalse[p.key] = false; });
    });
    setLocalPerms(allFalse);
    setIsDirty(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">
            Permissions {userName && <span className="text-muted-foreground font-normal">for {userName}</span>}
          </h3>
          {userRole && <Badge variant="outline" className="capitalize">{userRole}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSelectAll}>All On</Button>
          <Button variant="outline" size="sm" onClick={handleClearAll}>All Off</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
          <Card key={groupKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {groupIcons[groupKey]}
                {group.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.permissions.map(perm => (
                <div key={perm.key} className="flex items-center justify-between">
                  <Label htmlFor={`${userId}-${perm.key}`} className="text-sm cursor-pointer">
                    {perm.label}
                  </Label>
                  <Switch
                    id={`${userId}-${perm.key}`}
                    checked={localPerms[perm.key] ?? false}
                    onCheckedChange={v => handleToggle(perm.key, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {isDirty && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updatePermissions.isPending}>
            {updatePermissions.isPending ? 'Saving...' : 'Save Permissions'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default PermissionToggles;
