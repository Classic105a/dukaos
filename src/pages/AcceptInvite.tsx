import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Store, CheckCircle2, AlertCircle } from 'lucide-react';

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const token = params.get('token') || '';
  const [state, setState] = useState<'idle' | 'accepting' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [invite, setInvite] = useState<any>(null);
  const acceptingRef = useRef(false);

  // Lookup invite metadata (non-sensitive) by token
  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await supabase
        .from('invites')
        .select('email, role, status, expires_at, business_id, businesses:business_id(name)')
        .eq('token', token)
        .maybeSingle();
      setInvite(data);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (acceptingRef.current || state === 'done') return;
    acceptingRef.current = true;
    setState('accepting');
    const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
    if (error) {
      setState('error');
      setMessage(error.message);
      toast.error(error.message);
      acceptingRef.current = false;
      return;
    }
    const biz = (data as any)?.business_id;
    if (biz) localStorage.setItem('currentBusinessId', biz);
    sessionStorage.removeItem('pendingInviteToken');
    // Make the new tenant visible to BusinessSwitcher immediately
    await queryClient.invalidateQueries({ queryKey: ['businesses'] });
    setState('done');
    toast.success('You have joined the business');
    setTimeout(() => navigate('/dashboard'), 1200);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Missing invite token</CardTitle></CardHeader>
          <CardContent>
            <Link to="/auth"><Button>Go to sign in</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return null;

  if (!user) {
    // Persist token so signup/signin can resume
    sessionStorage.setItem('pendingInviteToken', token);
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-3">
              <Store className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle>You're invited!</CardTitle>
            <CardDescription>
              {invite?.businesses?.name
                ? `Join ${invite.businesses.name} as ${invite.role}.`
                : 'Sign in or create your account to accept the invite.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use the email address <strong>{invite?.email || 'the invited address'}</strong> when signing up.
            </p>
            <Link to={`/auth?invite=${token}`}>
              <Button className="w-full">Sign in or sign up</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Accept invite</CardTitle>
          <CardDescription>
            {invite?.businesses?.name
              ? `You've been invited to join ${invite.businesses.name} as ${invite.role}.`
              : 'Review and accept your invite below.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === 'done' && (
            <p className="text-sm flex items-center gap-2 text-success">
              <CheckCircle2 className="w-4 h-4" /> Joined! Redirecting…
            </p>
          )}
          {state === 'error' && (
            <p className="text-sm flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" /> {message}
            </p>
          )}
          <Button onClick={handleAccept} disabled={state === 'accepting' || state === 'done'} className="w-full">
            {state === 'accepting' ? 'Joining…' : 'Accept invite'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;