import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Receipt, Save, Eye } from 'lucide-react';

interface ReceiptSettingsData {
  id?: string;
  branch_id: string;
  show_logo: boolean;
  show_business_name: boolean;
  show_branch_name: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_email: boolean;
  show_website: boolean;
  show_mpesa_till: boolean;
  show_mpesa_paybill: boolean;
  show_kra_pin: boolean;
  show_cashier_name: boolean;
  show_customer_name: boolean;
  show_date_time: boolean;
  show_receipt_number: boolean;
  show_item_sku: boolean;
  show_item_tax: boolean;
  show_subtotal: boolean;
  show_total_tax: boolean;
  show_discount: boolean;
  show_footer_message: boolean;
  footer_message: string;
  show_return_policy: boolean;
  return_policy: string | null;
  paper_width: string;
}

const defaultSettings: Omit<ReceiptSettingsData, 'branch_id'> = {
  show_logo: true,
  show_business_name: true,
  show_branch_name: true,
  show_address: true,
  show_phone: true,
  show_email: false,
  show_website: false,
  show_mpesa_till: true,
  show_mpesa_paybill: true,
  show_kra_pin: true,
  show_cashier_name: true,
  show_customer_name: true,
  show_date_time: true,
  show_receipt_number: true,
  show_item_sku: false,
  show_item_tax: false,
  show_subtotal: true,
  show_total_tax: true,
  show_discount: true,
  show_footer_message: true,
  footer_message: 'Thank you for your business!',
  show_return_policy: false,
  return_policy: null,
  paper_width: '80mm',
};

export const ReceiptSettings = () => {
  const { currentBranch } = useBranch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<ReceiptSettingsData | null>(null);

  // Fetch receipt settings for current branch
  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ['receipt-settings', currentBranch?.id],
    queryFn: async () => {
      if (!currentBranch?.id) return null;
      const { data, error } = await supabase
        .from('receipt_settings')
        .select('*')
        .eq('branch_id', currentBranch.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentBranch?.id,
  });

  useEffect(() => {
    if (savedSettings) {
      setSettings(savedSettings as ReceiptSettingsData);
    } else if (currentBranch?.id) {
      setSettings({ ...defaultSettings, branch_id: currentBranch.id });
    }
  }, [savedSettings, currentBranch?.id]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ReceiptSettingsData) => {
      if (data.id) {
        const { error } = await supabase
          .from('receipt_settings')
          .update(data)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('receipt_settings')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt-settings'] });
      toast({ title: 'Receipt settings saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error saving settings', description: error.message, variant: 'destructive' });
    },
  });

  const handleSave = () => {
    if (settings) {
      saveMutation.mutate(settings);
    }
  };

  const updateSetting = <K extends keyof ReceiptSettingsData>(
    key: K,
    value: ReceiptSettingsData[K]
  ) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (isLoading || !settings) {
    return <div className="animate-pulse h-96 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Receipt Configuration
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure what appears on printed receipts for {currentBranch?.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Header Elements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Header Elements</CardTitle>
            <CardDescription>Business information shown at the top of receipts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="show_logo">Show Logo</Label>
              <Switch
                id="show_logo"
                checked={settings.show_logo}
                onCheckedChange={(v) => updateSetting('show_logo', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_business_name">Business Name</Label>
              <Switch
                id="show_business_name"
                checked={settings.show_business_name}
                onCheckedChange={(v) => updateSetting('show_business_name', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_branch_name">Branch Name</Label>
              <Switch
                id="show_branch_name"
                checked={settings.show_branch_name}
                onCheckedChange={(v) => updateSetting('show_branch_name', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_address">Address</Label>
              <Switch
                id="show_address"
                checked={settings.show_address}
                onCheckedChange={(v) => updateSetting('show_address', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_phone">Phone Number</Label>
              <Switch
                id="show_phone"
                checked={settings.show_phone}
                onCheckedChange={(v) => updateSetting('show_phone', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_email">Email</Label>
              <Switch
                id="show_email"
                checked={settings.show_email}
                onCheckedChange={(v) => updateSetting('show_email', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_website">Website</Label>
              <Switch
                id="show_website"
                checked={settings.show_website}
                onCheckedChange={(v) => updateSetting('show_website', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Details</CardTitle>
            <CardDescription>M-Pesa and tax information on receipts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="show_mpesa_till">M-Pesa Till Number</Label>
              <Switch
                id="show_mpesa_till"
                checked={settings.show_mpesa_till}
                onCheckedChange={(v) => updateSetting('show_mpesa_till', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_mpesa_paybill">M-Pesa Paybill</Label>
              <Switch
                id="show_mpesa_paybill"
                checked={settings.show_mpesa_paybill}
                onCheckedChange={(v) => updateSetting('show_mpesa_paybill', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_kra_pin">KRA PIN</Label>
              <Switch
                id="show_kra_pin"
                checked={settings.show_kra_pin}
                onCheckedChange={(v) => updateSetting('show_kra_pin', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Receipt Body */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receipt Body</CardTitle>
            <CardDescription>Transaction details and item information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="show_receipt_number">Receipt Number</Label>
              <Switch
                id="show_receipt_number"
                checked={settings.show_receipt_number}
                onCheckedChange={(v) => updateSetting('show_receipt_number', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_date_time">Date & Time</Label>
              <Switch
                id="show_date_time"
                checked={settings.show_date_time}
                onCheckedChange={(v) => updateSetting('show_date_time', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_cashier_name">Cashier Name</Label>
              <Switch
                id="show_cashier_name"
                checked={settings.show_cashier_name}
                onCheckedChange={(v) => updateSetting('show_cashier_name', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_customer_name">Customer Name</Label>
              <Switch
                id="show_customer_name"
                checked={settings.show_customer_name}
                onCheckedChange={(v) => updateSetting('show_customer_name', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_item_sku">Item SKU/Barcode</Label>
              <Switch
                id="show_item_sku"
                checked={settings.show_item_sku}
                onCheckedChange={(v) => updateSetting('show_item_sku', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_item_tax">Item Tax</Label>
              <Switch
                id="show_item_tax"
                checked={settings.show_item_tax}
                onCheckedChange={(v) => updateSetting('show_item_tax', v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="show_subtotal">Subtotal</Label>
              <Switch
                id="show_subtotal"
                checked={settings.show_subtotal}
                onCheckedChange={(v) => updateSetting('show_subtotal', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_total_tax">Total Tax</Label>
              <Switch
                id="show_total_tax"
                checked={settings.show_total_tax}
                onCheckedChange={(v) => updateSetting('show_total_tax', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="show_discount">Discount</Label>
              <Switch
                id="show_discount"
                checked={settings.show_discount}
                onCheckedChange={(v) => updateSetting('show_discount', v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer & Paper */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Footer & Paper</CardTitle>
            <CardDescription>Footer messages and paper settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="show_footer_message">Show Footer Message</Label>
              <Switch
                id="show_footer_message"
                checked={settings.show_footer_message}
                onCheckedChange={(v) => updateSetting('show_footer_message', v)}
              />
            </div>
            {settings.show_footer_message && (
              <div>
                <Label htmlFor="footer_message">Footer Message</Label>
                <Input
                  id="footer_message"
                  value={settings.footer_message}
                  onChange={(e) => updateSetting('footer_message', e.target.value)}
                  placeholder="Thank you for your business!"
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="show_return_policy">Show Return Policy</Label>
              <Switch
                id="show_return_policy"
                checked={settings.show_return_policy}
                onCheckedChange={(v) => updateSetting('show_return_policy', v)}
              />
            </div>
            {settings.show_return_policy && (
              <div>
                <Label htmlFor="return_policy">Return Policy</Label>
                <Textarea
                  id="return_policy"
                  value={settings.return_policy || ''}
                  onChange={(e) => updateSetting('return_policy', e.target.value)}
                  placeholder="Returns accepted within 7 days..."
                  rows={3}
                />
              </div>
            )}
            <Separator />
            <div>
              <Label htmlFor="paper_width">Paper Width</Label>
              <Select
                value={settings.paper_width}
                onValueChange={(v) => updateSetting('paper_width', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58mm (Narrow)</SelectItem>
                  <SelectItem value="80mm">80mm (Standard)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
