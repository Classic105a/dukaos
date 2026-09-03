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
import { Shield, Lock, KeyRound, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface ManagerApproval {
  id: string;
  email: string;
  role: string;
  /** Server-issued single-use approval record id (present when requestType is given). */
  approvalId?: string | null;
}

/** Server-side request types accepted by the approval_requests table. */
export type ApprovalRequestType = 'REFUND' | 'VOID' | 'DISCOUNT' | 'PRICE_OVERRIDE' | 'CREDIT_SALE';

interface ManagerApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (approverInfo: ManagerApproval) => void;
  actionType: string;
  actionDescription: string;
  entityId?: string;
  entityType?: 'sale' | 'return' | 'product' | 'customer' | 'stock_movement';
  /** When set, the server records a single-use approval that privileged RPCs consume. */
  requestType?: ApprovalRequestType;
}

const ManagerApprovalDialog = ({
  isOpen,
  onClose,
  onApprove,
  actionType,
  actionDescription,
  entityId,
  entityType,
  requestType,
}: ManagerApprovalDialogProps) => {
  const [authMethod, setAuthMethod] = useState<'password' | 'pin'>('pin');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { log } = useAuditLog();
  const { user } = useAuth();
  const { currentBranch } = useBranch();

  const handleReset = () => {
    setManagerEmail('');
    setManagerPassword('');
    setManagerPin('');
    setAuthMethod('pin');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const verifyViaEdgeFunction = async (method: 'pin' | 'password'): Promise<ManagerApproval> => {
    const businessId = (currentBranch as any)?.business_id as string | undefined;
    if (!businessId || !currentBranch?.id) throw new Error('Select a branch before requesting approval');

    const payload: Record<string, string | undefined> = {
      method,
      business_id: businessId,
      branch_id: currentBranch.id,
      request_type: requestType,
      entity_id: entityId,
      reason: actionDescription,
    };
    if (method === 'pin') {
      if (managerPin.length !== 4) throw new Error('PIN must be 4 digits');
      payload.pin = managerPin;
    } else {
      if (!managerEmail || !managerPassword) throw new Error('Email and password required');
      payload.email = managerEmail;
      payload.password = managerPassword;
    }

    const { data, error } = await supabase.functions.invoke('verify-manager', {
      body: payload,
    });

    if (error) {
      // FunctionsHttpError carries the JSON body on context
      let message = 'Verification failed';
      try {
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        }
      } catch { /* ignore */ }
      throw new Error(data?.error || message);
    }

    if (!data?.id) {
      throw new Error(data?.error || 'Invalid response from verification');
    }

    return { id: data.id, email: data.email, role: data.role, approvalId: data.approval_id ?? null };
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);

    try {
      const approverInfo = await verifyViaEdgeFunction(authMethod);

      log('APPROVAL_GRANTED', (entityType || 'approval') as any, entityId, undefined, {
        action_type: actionType,
        action_description: actionDescription,
        approved_by: approverInfo.id,
        approver_email: approverInfo.email,
        requested_by: user?.id,
      });

      toast.success(`${actionType} approved by ${approverInfo.email}`);
      handleReset();
      onApprove(approverInfo);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Verification failed');

      log('APPROVAL_DENIED', (entityType || 'approval') as any, entityId, undefined, {
        action_type: actionType,
        action_description: actionDescription,
        requested_by: user?.id,
        error: error.message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
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
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
            <div>
              <p className="text-sm font-medium">{actionType}</p>
              <p className="text-xs text-muted-foreground">{actionDescription}</p>
            </div>
          </div>
        </div>

        <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as 'password' | 'pin')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pin" className="gap-2">
              <KeyRound className="w-4 h-4" />
              Manager PIN
            </TabsTrigger>
            <TabsTrigger value="password" className="gap-2">
              <Lock className="w-4 h-4" />
              Password
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleVerify} className="space-y-4 mt-4">
            <TabsContent value="pin" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="manager-pin">Enter 4-Digit Manager PIN</Label>
                <Input
                  id="manager-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="• • • •"
                  className="text-center text-2xl tracking-[1em] font-mono"
                  autoComplete="off"
                  required={authMethod === 'pin'}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Managers can set their PIN in Settings → Profile
              </p>
            </TabsContent>

            <TabsContent value="password" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="manager-email">Manager Email</Label>
                <Input
                  id="manager-email"
                  type="email"
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  placeholder="manager@example.com"
                  required={authMethod === 'password'}
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
                  required={authMethod === 'password'}
                />
              </div>
            </TabsContent>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isVerifying || (authMethod === 'pin' ? managerPin.length !== 4 : !managerEmail || !managerPassword)}
                className="flex-1"
              >
                {isVerifying ? 'Verifying...' : (
                  <>
                    <Shield className="w-4 h-4 mr-1" />
                    Approve
                  </>
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerApprovalDialog;
