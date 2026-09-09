import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusiness } from '@/hooks/useBusiness';
import { useBranch } from '@/hooks/useBranch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Store, Building2, Users, Check, ArrowRight, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { INVITE_ROLES, INVITE_ROLE_LABELS, type InviteRole } from '@/lib/invite-roles';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BUSINESS_TYPES = [
  { value: 'retail', label: 'Retail shop' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'restaurant', label: 'Restaurant / Bar' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'other', label: 'Other' },
];

interface StaffRow {
  email: string;
  role: InviteRole;
}

const STEPS = [
  { key: 'business', label: 'Business', icon: Store },
  { key: 'branch', label: 'First branch', icon: Building2 },
  { key: 'staff', label: 'Staff', icon: Users },
] as const;

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { currentBusiness, isLoading } = useBusiness();
  const { refetch: refetchBranches } = useBranch();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [biz, setBiz] = useState({ name: '', type: 'retail', phone: '', town: '', kra_pin: '' });
  const [branch, setBranch] = useState({ name: 'Main Branch', location: '', phone: '' });
  const [branchId, setBranchId] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([{ email: '', role: 'cashier' }]);

  // Prefill from the auto-created business record.
  useEffect(() => {
    if (!currentBusiness) return;
    setBiz(prev => prev.name ? prev : {
      name: currentBusiness.name?.replace(/'s Business$/, '') || '',
      type: currentBusiness.type || 'retail',
      phone: '',
      town: '',
      kra_pin: '',
    });
  }, [currentBusiness]);

  if (isLoading || !currentBusiness) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const saveBusiness = async () => {
    if (!biz.name.trim()) { toast.error('Enter your business name'); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name: biz.name.trim(),
          type: biz.type,
          industry: biz.type,
          phone: biz.phone.trim() || null,
          town: biz.town.trim() || null,
          kra_pin: biz.kra_pin.trim() || null,
          owner_name: (user?.user_metadata as any)?.full_name || null,
        })
        .eq('id', currentBusiness.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['businesses'] });
      setStep(1);
    } catch (e: any) {
      toast.error(e.message || 'Could not save your business details');
    } finally {
      setSaving(false);
    }
  };

  const saveBranch = async () => {
    if (!branch.name.trim()) { toast.error('Give your branch a name'); return; }
    setSaving(true);
    try {
      if (branchId) {
        const { error } = await supabase
          .from('branches')
          .update({
            name: branch.name.trim(),
            location: branch.location.trim() || null,
            phone: branch.phone.trim() || null,
          })
          .eq('id', branchId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('branches')
          .insert({
            business_id: currentBusiness.id,
            name: branch.name.trim(),
            location: branch.location.trim() || null,
            phone: branch.phone.trim() || null,
            is_headquarters: true,
            is_active: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        setBranchId(data.id);
        localStorage.setItem('currentBranchId', data.id);
      }
      await refetchBranches();
      setStep(2);
    } catch (e: any) {
      toast.error(e.message || 'Could not create the branch');
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    setSaving(true);
    try {
      const invites = staff.filter(s => s.email.trim());
      for (const s of invites) {
        const { error } = await supabase.rpc('create_invite', {
          p_business_id: currentBusiness.id,
          p_email: s.email.trim(),
          p_role: s.role,
        });
        if (error) throw new Error(`${s.email}: ${error.message}`);
      }
      const { error } = await supabase
        .from('businesses')
        .update({ onboarded_at: new Date().toISOString() })
        .eq('id', currentBusiness.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['businesses'] });
      toast.success(invites.length ? `Setup complete — ${invites.length} invite(s) sent` : 'Setup complete');
      navigate('/dashboard', { replace: true });
    } catch (e: any) {
      toast.error(e.message || 'Could not finish setup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 bg-gradient-hero rounded-2xl flex items-center justify-center shadow-glow">
            <Store className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold">Set up your business</h1>
            <p className="text-sm text-muted-foreground">Three quick steps and you can start selling.</p>
          </div>
        </div>

        {/* Stepper */}
        <ol className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <li key={s.key} className="flex-1">
                <div className={cn(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors',
                  active && 'border-primary bg-primary/10 text-primary',
                  done && 'border-success/40 bg-success/10 text-success',
                  !active && !done && 'text-muted-foreground',
                )}>
                  {done ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Icon className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{s.label}</span>
                </div>
              </li>
            );
          })}
        </ol>

        <Card variant="elevated">
          {step === 0 && (
            <>
              <CardHeader>
                <CardTitle>Business details</CardTitle>
                <CardDescription>This appears on your receipts and reports.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="ob-name">Business name</Label>
                  <Input id="ob-name" value={biz.name} onChange={e => setBiz({ ...biz, name: e.target.value })} placeholder="e.g. Omoo Supermarket" />
                </div>
                <div>
                  <Label htmlFor="ob-type">Type of business</Label>
                  <Select value={biz.type} onValueChange={v => setBiz({ ...biz, type: v })}>
                    <SelectTrigger id="ob-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ob-phone">Phone</Label>
                    <Input id="ob-phone" value={biz.phone} onChange={e => setBiz({ ...biz, phone: e.target.value })} placeholder="07xx xxx xxx" />
                  </div>
                  <div>
                    <Label htmlFor="ob-town">Town</Label>
                    <Input id="ob-town" value={biz.town} onChange={e => setBiz({ ...biz, town: e.target.value })} placeholder="Nairobi" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="ob-kra">KRA PIN (optional)</Label>
                  <Input id="ob-kra" value={biz.kra_pin} onChange={e => setBiz({ ...biz, kra_pin: e.target.value })} placeholder="P0512345678X" />
                </div>
                <Button className="w-full" onClick={saveBusiness} disabled={saving || !biz.name.trim()}>
                  Continue <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </>
          )}

          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Your first branch</CardTitle>
                <CardDescription>Every sale is recorded against a branch. You can add more later.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="ob-bname">Branch name</Label>
                  <Input id="ob-bname" value={branch.name} onChange={e => setBranch({ ...branch, name: e.target.value })} placeholder="Main Branch" />
                </div>
                <div>
                  <Label htmlFor="ob-bloc">Location</Label>
                  <Input id="ob-bloc" value={branch.location} onChange={e => setBranch({ ...branch, location: e.target.value })} placeholder="Tom Mboya Street" />
                </div>
                <div>
                  <Label htmlFor="ob-bphone">Branch phone (optional)</Label>
                  <Input id="ob-bphone" value={branch.phone} onChange={e => setBranch({ ...branch, phone: e.target.value })} placeholder="07xx xxx xxx" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(0)} disabled={saving}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button className="flex-1" onClick={saveBranch} disabled={saving || !branch.name.trim()}>
                    Continue <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Invite your staff</CardTitle>
                <CardDescription>Optional. Each person gets their own sign-in with the role you choose.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {staff.map((row, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`ob-staff-${i}`} className={i > 0 ? 'sr-only' : undefined}>Email</Label>
                      <Input
                        id={`ob-staff-${i}`}
                        type="email"
                        value={row.email}
                        onChange={e => setStaff(staff.map((s, j) => j === i ? { ...s, email: e.target.value } : s))}
                        placeholder="staff@example.com"
                      />
                    </div>
                    <div className="w-32 shrink-0">
                      <Select
                        value={row.role}
                        onValueChange={v => setStaff(staff.map((s, j) => j === i ? { ...s, role: v as InviteRole } : s))}
                      >
                        <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INVITE_ROLES.map(r => <SelectItem key={r} value={r}>{INVITE_ROLE_LABELS[r]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {staff.length > 1 && (
                      <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setStaff(staff.filter((_, j) => j !== i))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setStaff([...staff, { email: '', role: 'cashier' }])}>
                  <Plus className="w-4 h-4 mr-1" /> Add another
                </Button>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button className="flex-1" onClick={finish} disabled={saving}>
                    {saving ? 'Finishing...' : 'Start Selling'}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
