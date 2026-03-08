import { useState, useEffect } from 'react';
import { Download, CheckCircle2, Smartphone, Wifi, WifiOff, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  const features = [
    { icon: WifiOff, title: 'Works Offline', desc: 'Process sales without internet', color: 'text-destructive' },
    { icon: Zap, title: 'Instant Loading', desc: 'Opens in under 2 seconds', color: 'text-warning' },
    { icon: Shield, title: 'Secure Data', desc: 'Encrypted local storage', color: 'text-success' },
    { icon: Wifi, title: 'Auto Sync', desc: 'Syncs when back online', color: 'text-info' },
  ];

  if (isStandalone || installed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">DukaOS is Installed!</h1>
        <p className="text-muted-foreground max-w-sm">You can now find DukaOS on your home screen. It works fully offline.</p>
        <Button onClick={() => window.location.href = '/dashboard'} className="mt-4">Open POS</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-6 pt-12">
      <div className="w-20 h-20 bg-gradient-hero rounded-2xl flex items-center justify-center shadow-glow mb-6">
        <Smartphone className="w-10 h-10 text-primary-foreground" />
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2">Install DukaOS</h1>
      <p className="text-muted-foreground text-center max-w-sm mb-8">
        Install the app on your device for offline access, faster loading, and a native app experience.
      </p>

      {deferredPrompt ? (
        <Button size="lg" onClick={handleInstall} className="w-full max-w-sm mb-8 gap-2">
          <Download className="w-5 h-5" />
          Install Now
        </Button>
      ) : (
        <Card className="w-full max-w-sm mb-8 border-dashed">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            <p className="font-medium mb-1">Manual Install</p>
            <p><strong>Android:</strong> Tap browser menu → "Add to Home Screen"</p>
            <p><strong>iPhone:</strong> Tap Share → "Add to Home Screen"</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {features.map(({ icon: Icon, title, desc, color }) => (
          <Card key={title} className="border-border">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <Icon className={cn('w-6 h-6', color)} />
              <span className="text-xs font-semibold text-foreground">{title}</span>
              <span className="text-[10px] text-muted-foreground">{desc}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Install;
