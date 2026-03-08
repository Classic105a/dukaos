import { useState, useEffect } from 'react';
import { Download, CheckCircle2, Smartphone, Wifi, WifiOff, Shield, Zap, Chrome, Share2, MoreVertical, PlusSquare, ExternalLink } from 'lucide-react';
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
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    // Detect standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // Check SW registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) setSwReady(true);
      });
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
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
      <p className="text-muted-foreground text-center max-w-sm mb-6">
        Install the app on your device for offline access, faster loading, and a native app experience.
      </p>

      {/* Status indicators */}
      <div className="flex items-center gap-2 mb-6">
        <span className={cn("w-2 h-2 rounded-full", swReady ? "bg-success" : "bg-muted")} />
        <span className="text-xs text-muted-foreground">
          {swReady ? "Service Worker active" : "Service Worker loading…"}
        </span>
      </div>

      {deferredPrompt ? (
        <Button size="lg" onClick={handleInstall} className="w-full max-w-sm mb-8 gap-2">
          <Download className="w-5 h-5" />
          Install Now
        </Button>
      ) : (
        <Card className="w-full max-w-sm mb-8 border-border">
          <CardContent className="p-5">
            <p className="font-semibold text-foreground text-sm mb-4 text-center">How to Install</p>

            {platform === 'ios' ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Open in Safari</p>
                    <p className="text-xs text-muted-foreground">This must be done in Safari browser</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">2</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Tap the Share button</p>
                    <Share2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">3</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Tap "Add to Home Screen"</p>
                    <PlusSquare className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ) : platform === 'android' ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Open in Chrome</p>
                    <p className="text-xs text-muted-foreground">Use Chrome or Edge browser</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">2</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">Tap the menu</p>
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">3</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">Tap "Install app" or "Add to Home Screen"</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Chrome className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Use Chrome or Edge</p>
                    <p className="text-xs text-muted-foreground">Click the install icon in the address bar</p>
                  </div>
                </div>
              </div>
            )}

            {/* Open in browser button for iframe contexts */}
            {window.self !== window.top && (
              <Button
                variant="outline"
                className="w-full mt-4 gap-2"
                onClick={() => window.open(window.location.href, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
                Open in Browser to Install
              </Button>
            )}
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
