import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Printer,
  Plus,
  Bluetooth,
  Usb,
  Wifi,
  Trash2,
  TestTube,
  Check,
  X,
  Search,
} from 'lucide-react';
import {
  connectBluetoothPrinter,
  connectUSBPrinter,
  printViaBluetooth,
  printViaUSB,
  generateTestPage,
  textToBytes,
  PrinterConfig,
} from '@/lib/escpos';
import { NetworkPrinterDiscovery } from './NetworkPrinterDiscovery';

interface PrinterConfiguration {
  id: string;
  branch_id: string;
  name: string;
  connection_type: 'bluetooth' | 'usb' | 'ethernet';
  bluetooth_device_id: string | null;
  bluetooth_device_name: string | null;
  usb_vendor_id: string | null;
  usb_product_id: string | null;
  ip_address: string | null;
  port: number;
  printer_brand: string;
  printer_model: string | null;
  paper_width: number;
  characters_per_line: number;
  is_default: boolean;
  is_active: boolean;
  last_connected_at: string | null;
}

interface PrinterFormData {
  name: string;
  connection_type: 'bluetooth' | 'usb' | 'ethernet';
  ip_address: string | null;
  port: number;
  printer_brand: string;
  paper_width: number;
  characters_per_line: number;
  is_active: boolean;
  is_default: boolean;
}

const CONNECTION_ICONS = {
  bluetooth: Bluetooth,
  usb: Usb,
  ethernet: Wifi,
};

export const PrinterSettings = () => {
  const { currentBranch } = useBranch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  // Fetch printer configurations
  const { data: printers = [], isLoading } = useQuery({
    queryKey: ['printer-configurations', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return [];
      const { data, error } = await supabase
        .from('printer_configurations')
        .select('*')
        .eq('branch_id', currentBranch.id)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data as PrinterConfiguration[];
    },
    enabled: !!currentBranch?.id,
  });

  // Create printer mutation
  const createPrinter = useMutation({
    mutationFn: async (data: PrinterFormData) => {
      const { error } = await supabase
        .from('printer_configurations')
        .insert([{ 
          ...data, 
          branch_id: currentBranch?.id!,
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-configurations'] });
      toast({ title: 'Printer added successfully' });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding printer', description: error.message, variant: 'destructive' });
    },
  });

  // Update printer mutation
  const updatePrinter = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PrinterConfiguration> & { id: string }) => {
      const { error } = await supabase
        .from('printer_configurations')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-configurations'] });
      toast({ title: 'Printer updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating printer', description: error.message, variant: 'destructive' });
    },
  });

  // Delete printer mutation
  const deletePrinter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('printer_configurations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-configurations'] });
      toast({ title: 'Printer removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error removing printer', description: error.message, variant: 'destructive' });
    },
  });

  // Test print function
  const handleTestPrint = async (printer: PrinterConfiguration) => {
    setConnecting(printer.id);
    try {
      const config: PrinterConfig = {
        paperWidth: printer.paper_width as 58 | 80,
        charactersPerLine: printer.characters_per_line,
        brand: printer.printer_brand as 'xprinter' | 'epson' | 'generic',
      };
      
      const testPageText = generateTestPage(config);
      const testPageBytes = textToBytes(testPageText);
      
      if (printer.connection_type === 'bluetooth') {
        const btPrinter = await connectBluetoothPrinter();
        if (!btPrinter) {
          throw new Error('Failed to connect to Bluetooth printer');
        }
        await printViaBluetooth(btPrinter, testPageBytes);
        
        // Update last connected
        await updatePrinter.mutateAsync({
          id: printer.id,
          bluetooth_device_id: btPrinter.device.id,
          bluetooth_device_name: btPrinter.device.name || undefined,
          last_connected_at: new Date().toISOString(),
        });
        
        toast({ title: 'Test page printed successfully' });
      } else if (printer.connection_type === 'usb') {
        const usbPrinter = await connectUSBPrinter();
        if (!usbPrinter) {
          throw new Error('Failed to connect to USB printer');
        }
        await printViaUSB(usbPrinter, testPageBytes);
        
        await updatePrinter.mutateAsync({
          id: printer.id,
          last_connected_at: new Date().toISOString(),
        });
        
        toast({ title: 'Test page printed successfully' });
      } else if (printer.connection_type === 'ethernet') {
        // Ethernet printing would need a backend proxy
        toast({ 
          title: 'Ethernet printing', 
          description: 'Sending to printer at ' + printer.ip_address + ':' + printer.port,
        });
      }
    } catch (error) {
      console.error('Print error:', error);
      toast({ 
        title: 'Print failed', 
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setConnecting(null);
    }
  };

  const setAsDefault = async (printerId: string) => {
    // First, unset all defaults
    for (const printer of printers) {
      if (printer.is_default && printer.id !== printerId) {
        await updatePrinter.mutateAsync({ id: printer.id, is_default: false });
      }
    }
    // Then set the new default
    await updatePrinter.mutateAsync({ id: printerId, is_default: true });
  };

  if (isLoading) {
    return <div className="animate-pulse h-96 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Printer Configuration
          </h2>
          <p className="text-sm text-muted-foreground">
            Connect and configure thermal printers for {currentBranch?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDiscoveryOpen(true)}>
            <Search className="w-4 h-4 mr-2" />
            Discover
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Printer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Printer</DialogTitle>
              </DialogHeader>
              <PrinterForm onSubmit={(data) => createPrinter.mutate(data)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <NetworkPrinterDiscovery
        open={discoveryOpen}
        onOpenChange={setDiscoveryOpen}
        onPrinterSelect={(printer) => {
          createPrinter.mutate({
            name: printer.name,
            connection_type: 'ethernet',
            ip_address: printer.ip_address,
            port: printer.port,
            printer_brand: 'generic',
            paper_width: 80,
            characters_per_line: 48,
            is_active: true,
            is_default: false,
          });
        }}
      />

      {printers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Printer className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No printers configured</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add a Bluetooth, USB, or Ethernet thermal printer to start printing receipts.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Printer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {printers.map(printer => {
            const ConnectionIcon = CONNECTION_ICONS[printer.connection_type];
            
            return (
              <Card key={printer.id} className={printer.is_default ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <ConnectionIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {printer.name}
                          {printer.is_default && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {printer.printer_brand.toUpperCase()} • {printer.paper_width}mm • {printer.connection_type}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {printer.is_active ? (
                        <Badge variant="outline" className="text-xs text-green-600">
                          <Check className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          <X className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm text-muted-foreground mb-4">
                    {printer.connection_type === 'bluetooth' && printer.bluetooth_device_name && (
                      <p>Device: {printer.bluetooth_device_name}</p>
                    )}
                    {printer.connection_type === 'ethernet' && printer.ip_address && (
                      <p>IP: {printer.ip_address}:{printer.port}</p>
                    )}
                    {printer.last_connected_at && (
                      <p>Last connected: {new Date(printer.last_connected_at).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestPrint(printer)}
                      disabled={connecting === printer.id}
                    >
                      <TestTube className="w-4 h-4 mr-1" />
                      {connecting === printer.id ? 'Connecting...' : 'Test Print'}
                    </Button>
                    {!printer.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAsDefault(printer.id)}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deletePrinter.mutate(printer.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Browser Support Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Browser Compatibility</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Bluetooth className="w-4 h-4 mt-0.5 text-blue-500" />
              <div>
                <p className="font-medium">Bluetooth</p>
                <p className="text-muted-foreground">Chrome, Edge (desktop only)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Usb className="w-4 h-4 mt-0.5 text-green-500" />
              <div>
                <p className="font-medium">USB</p>
                <p className="text-muted-foreground">Chrome, Edge (desktop only)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Wifi className="w-4 h-4 mt-0.5 text-purple-500" />
              <div>
                <p className="font-medium">Ethernet/Network</p>
                <p className="text-muted-foreground">All browsers (via backend)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Printer Form Component
const PrinterForm = ({ 
  onSubmit 
}: { 
  onSubmit: (data: PrinterFormData) => void;
}) => {
  const [formData, setFormData] = useState({
    name: '',
    connection_type: 'bluetooth' as 'bluetooth' | 'usb' | 'ethernet',
    ip_address: '',
    port: '9100',
    printer_brand: 'generic',
    paper_width: '80',
    characters_per_line: '48',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      connection_type: formData.connection_type,
      ip_address: formData.connection_type === 'ethernet' ? formData.ip_address : null,
      port: parseInt(formData.port),
      printer_brand: formData.printer_brand,
      paper_width: parseInt(formData.paper_width),
      characters_per_line: parseInt(formData.characters_per_line),
      is_active: true,
      is_default: false,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Printer Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Main Counter Printer"
          required
        />
      </div>
      
      <div>
        <Label htmlFor="connection_type">Connection Type</Label>
        <Select
          value={formData.connection_type}
          onValueChange={(v: 'bluetooth' | 'usb' | 'ethernet') => setFormData({ ...formData, connection_type: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bluetooth">
              <div className="flex items-center gap-2">
                <Bluetooth className="w-4 h-4" />
                Bluetooth
              </div>
            </SelectItem>
            <SelectItem value="usb">
              <div className="flex items-center gap-2">
                <Usb className="w-4 h-4" />
                USB
              </div>
            </SelectItem>
            <SelectItem value="ethernet">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                Ethernet/Network
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.connection_type === 'ethernet' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ip_address">IP Address *</Label>
            <Input
              id="ip_address"
              value={formData.ip_address}
              onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
              placeholder="192.168.1.100"
              required
            />
          </div>
          <div>
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: e.target.value })}
              placeholder="9100"
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="printer_brand">Printer Brand</Label>
        <Select
          value={formData.printer_brand}
          onValueChange={(v) => setFormData({ ...formData, printer_brand: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="xprinter">XPrinter</SelectItem>
            <SelectItem value="epson">Epson TM Series</SelectItem>
            <SelectItem value="star">Star Micronics</SelectItem>
            <SelectItem value="generic">Generic ESC/POS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="paper_width">Paper Width</Label>
          <Select
            value={formData.paper_width}
            onValueChange={(v) => {
              const chars = v === '58' ? '32' : '48';
              setFormData({ ...formData, paper_width: v, characters_per_line: chars });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="58">58mm (Narrow)</SelectItem>
              <SelectItem value="80">80mm (Standard)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="characters_per_line">Characters/Line</Label>
          <Input
            id="characters_per_line"
            value={formData.characters_per_line}
            onChange={(e) => setFormData({ ...formData, characters_per_line: e.target.value })}
          />
        </div>
      </div>

      <Button type="submit" className="w-full">Add Printer</Button>
    </form>
  );
};
