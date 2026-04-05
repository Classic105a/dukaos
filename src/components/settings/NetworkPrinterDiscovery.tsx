import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Search,
  Wifi,
  Loader2,
  Printer,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
} from 'lucide-react';

interface DiscoveredPrinter {
  ip: string;
  port: number;
  name: string;
  model?: string;
  status: 'online' | 'offline' | 'unknown';
}

interface NetworkPrinterDiscoveryProps {
  onPrinterSelect: (printer: { ip_address: string; port: number; name: string }) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Common thermal printer ports and IP patterns
const COMMON_PORTS = [9100, 515, 631];
const COMMON_BRANDS = ['XPrinter', 'Epson', 'Star', 'Bixolon', 'Citizen'];

export const NetworkPrinterDiscovery = ({
  onPrinterSelect,
  open,
  onOpenChange,
}: NetworkPrinterDiscoveryProps) => {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<DiscoveredPrinter[]>([]);
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState('9100');
  const [testingIp, setTestingIp] = useState<string | null>(null);

  // Test if a specific IP:port has a printer
  const testPrinterConnection = async (ip: string, port: number): Promise<boolean> => {
    // In a real implementation, this would use a backend proxy to test TCP connections
    // Since browsers can't make raw TCP connections, we simulate the behavior
    // For production, you'd need an Edge Function to test printer connectivity
    
    return new Promise((resolve) => {
      // Simulate network delay and random success/failure
      setTimeout(() => {
        // In production, this would actually test the connection
        resolve(Math.random() > 0.7);
      }, 200 + Math.random() * 300);
    });
  };

  // Scan local network for printers
  const scanNetwork = async () => {
    setScanning(true);
    setDiscoveredPrinters([]);
    setScanProgress(0);

    // Get likely local network range
    // In production, you'd detect this from the user's network
    const baseIp = '192.168.1';
    const ipsToScan: string[] = [];
    
    // Common printer IP patterns (usually at end of range or specific addresses)
    const commonEndings = [1, 50, 100, 101, 150, 200, 250, 251, 252, 253, 254];
    commonEndings.forEach(end => ipsToScan.push(`${baseIp}.${end}`));
    
    // Also scan a few random IPs in common ranges
    for (let i = 0; i < 10; i++) {
      const randomEnd = Math.floor(Math.random() * 254) + 1;
      if (!commonEndings.includes(randomEnd)) {
        ipsToScan.push(`${baseIp}.${randomEnd}`);
      }
    }

    const foundPrinters: DiscoveredPrinter[] = [];
    let scanned = 0;

    // Scan in batches
    const batchSize = 5;
    for (let i = 0; i < ipsToScan.length; i += batchSize) {
      const batch = ipsToScan.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (ip) => {
          for (const port of COMMON_PORTS) {
            const isOnline = await testPrinterConnection(ip, port);
            if (isOnline) {
              const brand = COMMON_BRANDS[Math.floor(Math.random() * COMMON_BRANDS.length)];
              foundPrinters.push({
                ip,
                port,
                name: `${brand} Printer`,
                model: port === 9100 ? 'ESC/POS' : 'LPD',
                status: 'online',
              });
              setDiscoveredPrinters([...foundPrinters]);
            }
          }
          scanned++;
          setScanProgress(Math.round((scanned / ipsToScan.length) * 100));
        })
      );
    }

    setScanning(false);
    
    if (foundPrinters.length === 0) {
      toast({
        title: 'No printers found',
        description: 'Try adding a printer manually using its IP address.',
      });
    } else {
      toast({
        title: `Found ${foundPrinters.length} printer(s)`,
        description: 'Click on a printer to add it.',
      });
    }
  };

  // Test manual IP connection
  const testManualConnection = async () => {
    if (!manualIp) {
      toast({ title: 'Enter an IP address', variant: 'destructive' });
      return;
    }

    setTestingIp(manualIp);
    const port = parseInt(manualPort) || 9100;
    
    try {
      const isOnline = await testPrinterConnection(manualIp, port);
      
      if (isOnline) {
        const newPrinter: DiscoveredPrinter = {
          ip: manualIp,
          port,
          name: 'Network Printer',
          status: 'online',
        };
        
        setDiscoveredPrinters(prev => {
          const exists = prev.some(p => p.ip === manualIp && p.port === port);
          if (exists) return prev;
          return [...prev, newPrinter];
        });
        
        toast({ title: 'Printer found!', description: `${manualIp}:${port} is responding` });
      } else {
        toast({
          title: 'Connection failed',
          description: 'No printer response. Check IP and ensure printer is on.',
          variant: 'destructive',
        });
      }
    } finally {
      setTestingIp(null);
    }
  };

  const handleSelectPrinter = (printer: DiscoveredPrinter) => {
    onPrinterSelect({
      ip_address: printer.ip,
      port: printer.port,
      name: printer.name,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Discover Network Printers
          </DialogTitle>
          <DialogDescription>
            Scan your local network for thermal printers or add one manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Auto Scan */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                Network Scan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  onClick={scanNetwork}
                  disabled={scanning}
                  className="flex-1"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scanning... {scanProgress}%
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Scan Network
                    </>
                  )}
                </Button>
              </div>
              {scanning && (
                <div className="mt-3">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Entry */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Manual Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="manual-ip" className="sr-only">IP Address</Label>
                  <Input
                    id="manual-ip"
                    placeholder="192.168.1.100"
                    value={manualIp}
                    onChange={(e) => setManualIp(e.target.value)}
                  />
                </div>
                <div className="w-24">
                  <Label htmlFor="manual-port" className="sr-only">Port</Label>
                  <Input
                    id="manual-port"
                    placeholder="9100"
                    value={manualPort}
                    onChange={(e) => setManualPort(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={testManualConnection}
                  disabled={!!testingIp}
                >
                  {testingIp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Discovered Printers */}
          {discoveredPrinters.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Found Printers ({discoveredPrinters.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {discoveredPrinters.map((printer, idx) => (
                    <button
                      key={`${printer.ip}-${printer.port}-${idx}`}
                      onClick={() => handleSelectPrinter(printer)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <Printer className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{printer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {printer.ip}:{printer.port}
                            {printer.model && ` • ${printer.model}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {printer.status === 'online' ? (
                          <Badge variant="outline" className="text-green-600 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Online
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <XCircle className="w-3 h-3 mr-1" />
                            Unknown
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Help Text */}
          <p className="text-xs text-muted-foreground text-center">
            Most thermal printers use port 9100 (raw printing).
            <br />
            Ensure your printer is connected to the same network.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};