import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, Search, Receipt, Calendar, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { usePrinter } from '@/hooks/usePrinter';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { ReceiptData } from '@/lib/escpos';

interface SaleRecord {
  id: string;
  receipt_number: string;
  total_amount: number;
  created_at: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
}

interface ReprintReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ReprintReceiptModal = ({ isOpen, onClose }: ReprintReceiptModalProps) => {
  const { currentBranch } = useBranch();
  const { printReceipt, isPrinting: printerBusy } = usePrinter();
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [printing, setPrinting] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!currentBranch?.id) return;
    
    setSearching(true);
    try {
      let query = supabase
        .from('sales')
        .select('id, receipt_number, total_amount, created_at, subtotal, tax_amount, discount_amount')
        .eq('branch_id', currentBranch.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (searchQuery.trim()) {
        query = query.ilike('receipt_number', `%${searchQuery.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setRecentSales((data || []).map(d => ({
        ...d,
        tax_amount: d.tax_amount ?? 0,
        discount_amount: d.discount_amount ?? 0,
      })));
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search sales');
    } finally {
      setSearching(false);
    }
  };

  const handleReprint = async (sale: SaleRecord) => {
    setPrinting(sale.id);
    setPrintSuccess(null);
    
    try {
      // Fetch sale items
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('product_name, quantity, unit_price, total_amount')
        .eq('sale_id', sale.id);

      if (itemsError) throw itemsError;

      // Fetch payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('payment_method, amount, mpesa_reference')
        .eq('sale_id', sale.id);

      if (paymentsError) throw paymentsError;

      // Build receipt data for thermal printing
      const receiptData: ReceiptData = {
        header: {
          businessName: 'DukaOS',
          branchName: currentBranch?.name || '',
          address: currentBranch?.address || undefined,
          city: currentBranch?.city || undefined,
          phone: currentBranch?.phone || undefined,
          mpesaTill: currentBranch?.mpesa_till_number || undefined,
          mpesaPaybill: currentBranch?.mpesa_paybill_number || undefined,
          mpesaAccount: currentBranch?.mpesa_account_number || undefined,
          kraPin: currentBranch?.kra_pin || undefined,
        },
        receiptNumber: `${sale.receipt_number} (REPRINT)`,
        date: new Date(sale.created_at),
        items: (items || []).map(item => ({
          name: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_amount,
        })),
        subtotal: Number(sale.subtotal),
        taxAmount: Number(sale.tax_amount),
        discountAmount: Number(sale.discount_amount),
        totalAmount: Number(sale.total_amount),
        payments: (payments || []).map(p => ({
          method: p.payment_method.toUpperCase(),
          amount: p.amount,
          reference: p.mpesa_reference,
        })),
        footer: {
          message: currentBranch?.receipt_footer_message || 'Thank you for your business!',
        },
      };

      // Build HTML for browser fallback
      const receiptHtml = `
        <div style="font-family: monospace; max-width: 300px; margin: 0 auto; font-size: 12px;">
          <div style="text-align: center; margin-bottom: 10px;">
            <strong>DukaOS</strong><br/>
            ${currentBranch?.name || ''}<br/>
            ${currentBranch?.address || ''}<br/>
            ${currentBranch?.city || ''}<br/>
            ${currentBranch?.phone ? `Tel: ${currentBranch.phone}` : ''}
          </div>
          <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
          <div>Receipt: ${sale.receipt_number}</div>
          <div>Date: ${format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm')}</div>
          <div style="font-weight: bold; color: #666;">*** REPRINT ***</div>
          <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
          ${items?.map(item => `
            <div style="display: flex; justify-content: space-between;">
              <span>${item.product_name}</span>
              <span>KES ${Number(item.total_amount).toLocaleString()}</span>
            </div>
            <div style="font-size: 10px; color: #666;">
              ${item.quantity} × KES ${Number(item.unit_price).toLocaleString()}
            </div>
          `).join('')}
          <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal:</span><span>KES ${Number(sale.subtotal).toLocaleString()}</span>
          </div>
          ${Number(sale.tax_amount) > 0 ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Tax:</span><span>KES ${Number(sale.tax_amount).toLocaleString()}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; border-top: 1px dashed #000; padding-top: 4px;">
            <span>TOTAL:</span><span>KES ${Number(sale.total_amount).toLocaleString()}</span>
          </div>
          <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
          ${payments?.map(p => `
            <div style="display: flex; justify-content: space-between;">
              <span>${p.payment_method.toUpperCase()}</span>
              <span>KES ${Number(p.amount).toLocaleString()}</span>
            </div>
          `).join('')}
          <div style="text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 8px;">
            ${currentBranch?.receipt_footer_message || 'Thank you for your business!'}
          </div>
        </div>
      `;

      const result = await printReceipt(receiptData, {
        fallbackToBrowser: true,
        receiptHtml,
      });

      if (result.success) {
        setPrintSuccess(sale.id);
        if (result.method === 'thermal') {
          toast.success('Receipt reprinted successfully');
        }
        // Clear success state after 2 seconds
        setTimeout(() => setPrintSuccess(null), 2000);
      } else {
        toast.error(result.error || 'Failed to reprint receipt');
      }
    } catch (error) {
      console.error('Reprint error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reprint receipt');
    } finally {
      setPrinting(null);
    }
  };

  // Load recent sales on open
  const handleOpenChange = (open: boolean) => {
    if (open) {
      handleSearch();
    } else {
      setSearchQuery('');
      setRecentSales([]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Reprint Receipt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Search by receipt number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching}>
              <Search className="w-4 h-4" />
            </Button>
          </div>

          {/* Sales List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentSales.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                {searching ? 'Searching...' : 'No sales found'}
              </p>
            ) : (
              recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{sale.receipt_number}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(sale.created_at), 'dd MMM yyyy, HH:mm')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm">
                      KES {Number(sale.total_amount).toLocaleString()}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReprint(sale)}
                      disabled={printing === sale.id || printerBusy}
                      className="min-w-[40px]"
                    >
                      {printing === sale.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : printSuccess === sale.id ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Printer className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReprintReceiptModal;
