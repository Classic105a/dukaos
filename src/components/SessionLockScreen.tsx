import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, LogOut, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SessionLockScreenProps {
  onUnlock: (pin?: string) => boolean;
  hasPin: boolean;
}

const SessionLockScreen = ({ onUnlock, hasPin }: SessionLockScreenProps) => {
  const { user, signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = () => {
    if (hasPin) {
      const success = onUnlock(pin);
      if (!success) {
        setError('Incorrect PIN');
        setPin('');
      }
    } else {
      onUnlock();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/auth';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUnlock();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Session Locked</CardTitle>
          <p className="text-muted-foreground text-sm mt-2">
            Your session was locked due to inactivity
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            Logged in as <span className="font-medium text-foreground">{user?.email}</span>
          </div>

          {hasPin ? (
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showPin ? 'text' : 'password'}
                  placeholder="Enter your PIN"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setError('');
                  }}
                  onKeyDown={handleKeyDown}
                  maxLength={6}
                  className="text-center text-lg tracking-widest pr-10"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Click unlock to continue your session
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
            <Button
              className="flex-1"
              onClick={handleUnlock}
            >
              <Lock className="w-4 h-4 mr-2" />
              Unlock
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionLockScreen;
