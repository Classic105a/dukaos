import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface SessionWarningProps {
  timeUntilLock: number;
  onStayLoggedIn: () => void;
}

const SessionWarning = ({ timeUntilLock, onStayLoggedIn }: SessionWarningProps) => {
  const seconds = Math.ceil(timeUntilLock / 1000);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-warning/10 border border-warning rounded-lg p-4 shadow-lg max-w-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm">Session Timeout Warning</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Your session will be locked in <span className="font-bold text-warning">{seconds}s</span> due to inactivity.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={onStayLoggedIn}
            >
              Stay Logged In
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionWarning;
