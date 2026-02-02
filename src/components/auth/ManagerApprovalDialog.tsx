import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ManagerApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  actionType: string;
  actionDescription: string;
}

const ManagerApprovalDialog = ({
  isOpen,
  onClose,
  onApprove,
  actionType,
  actionDescription,
}: ManagerApprovalDialogProps) => {
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);

    try {
      // Attempt to sign in as manager (in the background)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: managerEmail,
        password: managerPassword,
      });

      if (authError) {
        toast.error('Invalid credentials');
        setIsVerifying(false);
        return;
      }

      // Check if user has manager or higher role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .single();

      if (roleError || !roleData) {
        toast.error('Could not verify role');
        setIsVerifying(false);
        return;
      }

      const approverRole = roleData.role;
      if (!['owner', 'admin', 'manager'].includes(approverRole)) {
        toast.error('Insufficient permissions. Manager or higher required.');
        setIsVerifying(false);
        return;
      }

      // Approved!
      toast.success(`${actionType} approved by ${managerEmail}`);
      setManagerEmail('');
      setManagerPassword('');
      onApprove();
      onClose();
    } catch (error) {
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <Shield className="w-5 h-5" />
            Manager Approval Required
          </DialogTitle>
          <DialogDescription>
            This action requires manager authorization.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-secondary/50 rounded-lg p-3 my-2">
          <p className="text-sm font-medium">{actionType}</p>
          <p className="text-xs text-muted-foreground">{actionDescription}</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manager-email">Manager Email</Label>
            <Input
              id="manager-email"
              type="email"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              placeholder="manager@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager-password" className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Password
            </Label>
            <Input
              id="manager-password"
              type="password"
              value={managerPassword}
              onChange={(e) => setManagerPassword(e.target.value)}
              placeholder="Enter manager password"
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isVerifying} className="flex-1">
              {isVerifying ? 'Verifying...' : (
                <>
                  <Shield className="w-4 h-4 mr-1" />
                  Approve
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerApprovalDialog;
