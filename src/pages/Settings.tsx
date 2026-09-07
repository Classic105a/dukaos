import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Shield,
  Building2,
  Users,
  Key,
  Bell,
  Palette,
  Plus,
  Trash2,
  Crown,
  Receipt,
  Printer,
  Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { BranchDetailsForm } from '@/components/settings/BranchDetailsForm';
import { ReceiptSettings } from '@/components/settings/ReceiptSettings';
import { PrinterSettings } from '@/components/settings/PrinterSettings';
import TaxSettings from '@/components/settings/TaxSettings';
import PermissionToggles from '@/components/staff/PermissionToggles';
import ApprovalSettings from '@/components/settings/ApprovalSettings';
import ModulesSettings from '@/components/settings/ModulesSettings';
import { useBusiness } from '@/hooks/useBusiness';
import { usePermissions } from '@/hooks/usePermissions';
import { Copy, Mail, X, LayoutGrid } from 'lucide-react';
import { INVITE_ROLES, INVITE_ROLE_LABELS, normalizeInviteRole, type InviteStatus } from '@/lib/invite-roles';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status?: string;
  created_at: string;
}

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Fetch current user profile
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user?.id,
  });

  // Role/permissions for the SELECTED business (business_users), not a global table.
  const { currentBusiness } = useBusiness();
  const { role: userRole, canManageUsers, canChangeMemberRoles } = usePermissions();
  const businessId = currentBusiness?.id ?? null;

  // Fetch team members of the current business (owner/admin only; RLS scopes profiles the same way)
  const { data: allUsers = [] } = useQuery({
    queryKey: ['team-members', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data: members, error: membersError } = await supabase
        .from('business_users')
        .select('user_id, role, is_owner, status, created_at')
        .eq('business_id', businessId);
      if (membersError) throw membersError;
      const ids = (members ?? []).map(m => m.user_id);
      if (ids.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, created_at')
        .in('id', ids);
      if (profilesError) throw profilesError;

      return (members ?? []).map(m => {
        const p = profiles?.find(pr => pr.id === m.user_id);
        return {
          id: m.user_id,
          email: p?.email ?? '',
          full_name: p?.full_name ?? null,
          role: m.is_owner ? 'owner' : (m.role || 'staff'),
          status: m.status ?? 'active',
          created_at: m.created_at,
        };
      }) as UserWithRole[];
    },
    enabled: !!businessId && canManageUsers,
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (profileData: Partial<Profile>) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({ title: 'Profile updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating profile', description: error.message, variant: 'destructive' });
    },
  });

  // Update a member's role IN THIS BUSINESS. RLS only lets business owners do this;
  // we verify a row actually changed so a silent RLS no-op is surfaced.
  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      if (!businessId) throw new Error('No business selected');
      const { data, error } = await supabase
        .from('business_users')
        .update({ role })
        .eq('business_id', businessId)
        .eq('user_id', userId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Only the business owner can change roles');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['business-membership'] });
      toast({ title: 'User role updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating role', description: error.message, variant: 'destructive' });
    },
  });

  const isAdmin = canManageUsers;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-primary/10 text-primary';
      case 'admin': return 'bg-warning/10 text-warning';
      case 'manager': return 'bg-info/10 text-info';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account, team, and preferences
          </p>
        </div>

        <Tabs
          value={searchParams.get('tab') || 'profile'}
          onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
          className="space-y-6"
        >
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 w-full max-w-2xl">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="team" className="gap-2">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Team</span>
                </TabsTrigger>
                <TabsTrigger value="branch" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Branch</span>
                </TabsTrigger>
                <TabsTrigger value="receipts" className="gap-2">
                  <Receipt className="w-4 h-4" />
                  <span className="hidden sm:inline">Receipts</span>
                </TabsTrigger>
                <TabsTrigger value="printers" className="gap-2">
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Printers</span>
                </TabsTrigger>
                <TabsTrigger value="tax" className="gap-2">
                  <Calculator className="w-4 h-4" />
                  <span className="hidden sm:inline">Tax</span>
                </TabsTrigger>
                <TabsTrigger value="approvals" className="gap-2">
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Approvals</span>
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="preferences" className="gap-2">
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="modules" className="gap-2">
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Modules</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <ProfileSettings 
              profile={profile}
              userRole={userRole}
              onUpdate={(data) => updateProfile.mutate(data)}
            />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <SecuritySettings />
          </TabsContent>

          {/* Team Tab */}
          {isAdmin && (
            <TabsContent value="team">
              <TeamSettings 
                users={allUsers}
                currentUserId={user?.id || ''}
                onUpdateRole={(userId, role) => updateUserRole.mutate({ userId, role })}
                canChangeRoles={canChangeMemberRoles}
                getRoleColor={getRoleColor}
              />
            </TabsContent>
          )}

          {/* Branch Tab */}
          {isAdmin && (
            <TabsContent value="branch">
              <BranchDetailsForm />
            </TabsContent>
          )}

          {/* Receipts Tab */}
          {isAdmin && (
            <TabsContent value="receipts">
              <ReceiptSettings />
            </TabsContent>
          )}

          {/* Printers Tab */}
          {isAdmin && (
            <TabsContent value="printers">
              <PrinterSettings />
            </TabsContent>
          )}

          {/* Tax Tab */}
          {isAdmin && (
            <TabsContent value="tax">
              <TaxSettings />
            </TabsContent>
          )}

          {/* Approvals Tab */}
          {isAdmin && (
            <TabsContent value="approvals">
              <ApprovalSettings />
            </TabsContent>
          )}

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <PreferencesSettings />
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules">
            <ModulesSettings currentRole={userRole} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

// Profile Settings Component
const ProfileSettings = ({ 
  profile, 
  userRole,
  onUpdate 
}: { 
  profile: Profile | null | undefined;
  userRole: string | null | undefined;
  onUpdate: (data: Partial<Profile>) => void;
}) => {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      full_name: formData.full_name || null,
      phone: formData.phone || null,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your personal details</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || '?'}
              </span>
            </div>
            <div>
              <h3 className="font-medium">{profile?.full_name || 'No name set'}</h3>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              {userRole && (
                <Badge variant="outline" className="mt-1 capitalize">
                  <Shield className="w-3 h-3 mr-1" />
                  {userRole}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Your full name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+254..."
              />
            </div>
          </div>

          <Button type="submit">Save Changes</Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Security Settings Component
const SecuritySettings = () => {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      toast({ title: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ title: 'Error updating password', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Settings</CardTitle>
        <CardDescription>Manage your password and security preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <Label htmlFor="new_password">New Password</Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm_password">Confirm Password</Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>
          <Button type="submit">Update Password</Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Team Settings Component
const TeamSettings = ({ 
  users, 
  currentUserId,
  onUpdateRole,
  canChangeRoles,
  getRoleColor,
}: { 
  users: UserWithRole[];
  currentUserId: string;
  onUpdateRole: (userId: string, role: string) => void;
  canChangeRoles: boolean;
  getRoleColor: (role: string) => string;
}) => {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('attendant');
  const [sending, setSending] = useState(false);
  const [inviteStatusFilter, setInviteStatusFilter] = useState<InviteStatus>('pending');

  const { data: invitesAll = [] } = useQuery({
    queryKey: ['invites', currentBusiness?.id],
    queryFn: async () => {
      if (!currentBusiness?.id) return [];
      const { data, error } = await supabase
        .from('invites')
        .select('id, email, role, status, expires_at, token, created_at, accepted_at')
        .eq('business_id', currentBusiness.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Treat pending-but-past-expiry as "expired" in the UI even before the cron runs.
  const decoratedInvites = invitesAll.map((inv: any) => ({
    ...inv,
    effective_status:
      inv.status === 'pending' && inv.expires_at && new Date(inv.expires_at) < new Date()
        ? 'expired'
        : inv.status,
  }));
  const filteredInvites = decoratedInvites.filter(i => i.effective_status === inviteStatusFilter);
  const inviteCounts = decoratedInvites.reduce<Record<string, number>>((acc, i) => {
    acc[i.effective_status] = (acc[i.effective_status] || 0) + 1;
    return acc;
  }, {});

  const handleSendInvite = async () => {
    if (!currentBusiness?.id || !inviteEmail.trim()) return;
    const role = normalizeInviteRole(inviteRole);
    if (!role) {
      toast({ title: 'Invalid role', description: 'Owners cannot be invited.', variant: 'destructive' });
      return;
    }
    setSending(true);
    const { data, error } = await supabase.rpc('create_invite', {
      p_business_id: currentBusiness.id,
      p_email: inviteEmail.trim(),
      p_role: role,
    });
    setSending(false);
    if (error) {
      toast({ title: 'Failed to send invite', description: error.message, variant: 'destructive' });
      return;
    }
    const link = `${window.location.origin}/accept-invite?token=${(data as any).token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast({ title: 'Invite sent', description: 'Link copied to clipboard. User will join after accepting.' });
    setInviteEmail('');
    setInviteRole('attendant');
    setInviteDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['invites'] });
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copied' });
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.rpc('revoke_invite', { p_invite_id: id });
    if (error) {
      toast({ title: 'Failed to revoke', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Invite revoked' });
    queryClient.invalidateQueries({ queryKey: ['invites'] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage team access and roles</CardDescription>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map(r => (
                      <SelectItem key={r} value={r}>{INVITE_ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Invite link will be copied to your clipboard. The user will join after accepting.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSendInvite} disabled={sending || !inviteEmail.trim()}>
                  <Mail className="w-4 h-4 mr-2" />
                  {sending ? 'Sending…' : 'Send Invite'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {decoratedInvites.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">Invites</h4>
            </div>
            <Tabs value={inviteStatusFilter} onValueChange={(v) => setInviteStatusFilter(v as InviteStatus)}>
              <TabsList className="grid w-full grid-cols-4">
                {(['pending','accepted','revoked','expired'] as InviteStatus[]).map(s => (
                  <TabsTrigger key={s} value={s} className="capitalize">
                    {s} {inviteCounts[s] ? `(${inviteCounts[s]})` : ''}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={inviteStatusFilter} className="mt-3">
                {filteredInvites.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No {inviteStatusFilter} invites</p>
                ) : (
                  <div className="space-y-2">
                    {filteredInvites.map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{inv.email}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {inv.role}
                            {inv.effective_status === 'pending' && ` · expires ${format(new Date(inv.expires_at), 'PP')}`}
                            {inv.effective_status === 'accepted' && inv.accepted_at && ` · joined ${format(new Date(inv.accepted_at), 'PP')}`}
                            {inv.effective_status === 'expired' && ` · expired ${format(new Date(inv.expires_at), 'PP')}`}
                            {inv.effective_status === 'revoked' && ' · revoked'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{inv.effective_status}</Badge>
                          {inv.effective_status === 'pending' && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => copyLink(inv.token)} aria-label="Copy invite link">
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => revokeInvite(inv.id)} aria-label="Revoke invite">
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
        <div className="space-y-4">
          {users.map(member => (
            <div key={member.id}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {member.full_name?.charAt(0) || member.email?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium flex items-center gap-2 truncate">
                      {member.full_name || 'Unnamed'}
                      {member.id === currentUserId && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Select 
                    value={member.role}
                    onValueChange={(role) => onUpdateRole(member.id, role)}
                    disabled={!canChangeRoles || member.id === currentUserId || member.role === 'owner'}
                  >
                    <SelectTrigger className={cn('w-32', getRoleColor(member.role))}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">
                        <div className="flex items-center gap-2">
                          <Crown className="w-3.5 h-3.5" />
                          Owner
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="attendant">Attendant</SelectItem>
                      <SelectItem value="cashier">Cashier</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Granular Permission Toggles */}
              {member.id !== currentUserId && member.role !== 'owner' && (
                <div className="mt-3 ml-4 p-4 border rounded-lg">
                  <PermissionToggles
                    userId={member.id}
                    userName={member.full_name || member.email}
                    userRole={member.role}
                  />
                </div>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No team members yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Preferences Settings Component
const PreferencesSettings = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Customize your experience</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Theme</h4>
              <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
            </div>
            <Select defaultValue="light">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Notifications</h4>
              <p className="text-sm text-muted-foreground">Receive alerts for low stock and sales</p>
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="important">Important</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Currency */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Currency</h4>
              <p className="text-sm text-muted-foreground">Default currency for transactions</p>
            </div>
            <Select defaultValue="kes">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kes">KES (KSh)</SelectItem>
                <SelectItem value="usd">USD ($)</SelectItem>
                <SelectItem value="eur">EUR (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Receipt Format */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Receipt Format</h4>
              <p className="text-sm text-muted-foreground">Default format for printed receipts</p>
            </div>
            <Select defaultValue="thermal">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thermal">Thermal (80mm)</SelectItem>
                <SelectItem value="a4">A4</SelectItem>
                <SelectItem value="letter">Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Settings;
