import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Building2, Save, Upload } from 'lucide-react';

interface BranchDetails {
  id: string;
  name: string;
  location: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  mpesa_till_number: string | null;
  mpesa_paybill_number: string | null;
  mpesa_account_number: string | null;
  business_registration_number: string | null;
  kra_pin: string | null;
  logo_url: string | null;
  opening_hours: string | null;
  receipt_footer_message: string | null;
  is_headquarters: boolean;
}

export const BranchDetailsForm = () => {
  const { currentBranch, refetch } = useBranch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<BranchDetails>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBranchDetails = async () => {
      if (!currentBranch?.id) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('id', currentBranch.id)
          .single();
        if (error) throw error;
        setFormData(data);
      } catch (error) {
        console.error('Error fetching branch details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBranchDetails();
  }, [currentBranch?.id]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<BranchDetails>) => {
      if (!currentBranch?.id) throw new Error('No branch selected');
      const { error } = await supabase
        .from('branches')
        .update(data)
        .eq('id', currentBranch.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast({ title: 'Branch details saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error saving branch details', description: error.message, variant: 'destructive' });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const updateField = (field: keyof BranchDetails, value: string | null) => {
    setFormData(prev => ({ ...prev, [field]: value || null }));
  };

  if (isLoading) {
    return <div className="animate-pulse h-96 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Branch Details
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage business information for {currentBranch?.name}
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
            <CardDescription>Branch name and location details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Branch Name *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="location">Location/Area</Label>
              <Input
                id="location"
                value={formData.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder="e.g., Westlands"
              />
            </div>
            <div>
              <Label htmlFor="address">Full Address</Label>
              <Textarea
                id="address"
                value={formData.address || ''}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Street address, building, floor..."
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city || ''}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="Nairobi"
              />
            </div>
            <div>
              <Label htmlFor="opening_hours">Opening Hours</Label>
              <Input
                id="opening_hours"
                value={formData.opening_hours || ''}
                onChange={(e) => updateField('opening_hours', e.target.value)}
                placeholder="Mon-Sat 8AM-8PM, Sun 10AM-6PM"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
            <CardDescription>Phone, email, and website</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+254 7XX XXX XXX"
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="branch@company.com"
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website || ''}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="www.company.com"
              />
            </div>
            <Separator />
            <div>
              <Label htmlFor="logo_url">Logo URL</Label>
              <div className="flex gap-2">
                <Input
                  id="logo_url"
                  value={formData.logo_url || ''}
                  onChange={(e) => updateField('logo_url', e.target.value)}
                  placeholder="https://..."
                />
                <Button variant="outline" size="icon" disabled>
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Used on receipts and branding
              </p>
            </div>
          </CardContent>
        </Card>

        {/* M-Pesa Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">M-Pesa Payment Details</CardTitle>
            <CardDescription>Till and Paybill numbers for payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="mpesa_till_number">M-Pesa Till Number</Label>
              <Input
                id="mpesa_till_number"
                value={formData.mpesa_till_number || ''}
                onChange={(e) => updateField('mpesa_till_number', e.target.value)}
                placeholder="123456"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Buy Goods Till Number
              </p>
            </div>
            <div>
              <Label htmlFor="mpesa_paybill_number">M-Pesa Paybill Number</Label>
              <Input
                id="mpesa_paybill_number"
                value={formData.mpesa_paybill_number || ''}
                onChange={(e) => updateField('mpesa_paybill_number', e.target.value)}
                placeholder="654321"
              />
            </div>
            <div>
              <Label htmlFor="mpesa_account_number">Default Account Number</Label>
              <Input
                id="mpesa_account_number"
                value={formData.mpesa_account_number || ''}
                onChange={(e) => updateField('mpesa_account_number', e.target.value)}
                placeholder="Account number for Paybill"
              />
            </div>
          </CardContent>
        </Card>

        {/* Business Registration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business Registration</CardTitle>
            <CardDescription>Legal and tax identification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="business_registration_number">Business Registration Number</Label>
              <Input
                id="business_registration_number"
                value={formData.business_registration_number || ''}
                onChange={(e) => updateField('business_registration_number', e.target.value)}
                placeholder="PVT-XXXXXXXX"
              />
            </div>
            <div>
              <Label htmlFor="kra_pin">KRA PIN</Label>
              <Input
                id="kra_pin"
                value={formData.kra_pin || ''}
                onChange={(e) => updateField('kra_pin', e.target.value)}
                placeholder="P00XXXXXXX"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Kenya Revenue Authority PIN
              </p>
            </div>
            <Separator />
            <div>
              <Label htmlFor="receipt_footer_message">Default Receipt Footer</Label>
              <Textarea
                id="receipt_footer_message"
                value={formData.receipt_footer_message || ''}
                onChange={(e) => updateField('receipt_footer_message', e.target.value)}
                placeholder="Thank you for shopping with us!"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
