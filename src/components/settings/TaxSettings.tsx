import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useTaxSettings } from '@/hooks/useTaxSettings';
import { toast } from 'sonner';
import { Calculator, Percent } from 'lucide-react';

const TaxSettings = () => {
  const { settings, updateSettings } = useTaxSettings();
  const [vatRate, setVatRate] = useState(settings.vatRate.toString());

  const handleSave = () => {
    const rate = parseFloat(vatRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('VAT rate must be between 0 and 100');
      return;
    }
    updateSettings({ vatRate: rate });
    toast.success('Tax settings saved');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Tax Settings
        </CardTitle>
        <CardDescription>
          Configure VAT and tax calculation for your sales
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Tax */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-medium">Enable Tax Calculation</Label>
            <p className="text-sm text-muted-foreground">
              Apply VAT to sales automatically
            </p>
          </div>
          <Switch
            checked={settings.enableTax}
            onCheckedChange={(checked) => updateSettings({ enableTax: checked })}
          />
        </div>

        {settings.enableTax && (
          <>
            {/* VAT Rate */}
            <div className="space-y-2">
              <Label htmlFor="vat-rate">VAT Rate (%)</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-32">
                  <Input
                    id="vat-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    className="pr-8"
                  />
                  <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Kenya standard VAT is 16%
                </span>
              </div>
            </div>

            {/* Tax Inclusive */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Prices Include Tax</Label>
                <p className="text-sm text-muted-foreground">
                  Your product prices already include VAT
                </p>
              </div>
              <Switch
                checked={settings.taxInclusive}
                onCheckedChange={(checked) => updateSettings({ taxInclusive: checked })}
              />
            </div>

            {/* Preview */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Preview</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                {settings.taxInclusive ? (
                  <>
                    <p>If product price is <strong>KES 1,160</strong>:</p>
                    <p>• Base price: KES {(1160 / (1 + parseFloat(vatRate || '16') / 100)).toFixed(2)}</p>
                    <p>• VAT ({vatRate}%): KES {(1160 - 1160 / (1 + parseFloat(vatRate || '16') / 100)).toFixed(2)}</p>
                    <p>• Total: <strong>KES 1,160</strong> (no change)</p>
                  </>
                ) : (
                  <>
                    <p>If product price is <strong>KES 1,000</strong>:</p>
                    <p>• Base price: KES 1,000</p>
                    <p>• VAT ({vatRate}%): KES {(1000 * parseFloat(vatRate || '16') / 100).toFixed(2)}</p>
                    <p>• Total: <strong>KES {(1000 * (1 + parseFloat(vatRate || '16') / 100)).toFixed(2)}</strong></p>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        <Button onClick={handleSave}>Save Tax Settings</Button>
      </CardContent>
    </Card>
  );
};

export default TaxSettings;
