import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useShift } from '@/hooks/useShift';
import { useBranch } from '@/hooks/useBranch';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Printer, FileText, Download, Clock, Wallet, CreditCard, Smartphone, AlertTriangle, CheckCircle, TrendingDown, TrendingUp, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZReportProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId?: string; // If provided, show historical shift; otherwise show current
}

interface ShiftData {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  expected_cash: number | null;
  actual_cash: number | null;
  cash_discrepancy: number | null;
  status: string | null;
  notes: string | null;
  cashier_id: string;
  branch_id: string;
}

const ZReport = ({ isOpen, onClose, shiftId }: ZReportProps) => {
  const { currentShift, getShiftSummary } = useShift();
  const { currentBranch } = useBranch();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const targetShiftId = shiftId || currentShift?.id;

  // Fetch shift data
  const { data: shiftData } = useQuery({
    queryKey: ['z-report-shift', targetShiftId],
    queryFn: async () => {
      if (!targetShiftId) return null;
      const { data, error } = await supabase
        .from('cashier_shifts')
        .select('*')
        .eq('id', targetShiftId)
        .single();
      if (error) throw error;
      return data as ShiftData;
    },
    enabled: isOpen && !!targetShiftId,
  });

  // Fetch cashier profile
  const { data: cashierProfile } = useQuery({
    queryKey: ['z-report-cashier', shiftData?.cashier_id],
    queryFn: async () => {
      if (!shiftData?.cashier_id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', shiftData.cashier_id)
        .single();
      return data;
    },
    enabled: !!shiftData?.cashier_id,
  });

  // Fetch sales for this shift
  const { data: salesData = [] } = useQuery({
    queryKey: ['z-report-sales', targetShiftId],
    queryFn: async () => {
      if (!targetShiftId) return [];
      const { data, error } = await supabase
        .from('sales')
        .select('id, total_amount, subtotal, tax_amount, discount_amount, cost_total, profit_total, payment_status, created_at')
        .eq('shift_id', targetShiftId);
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!targetShiftId,
  });

  // Fetch payments for shift sales
  const { data: paymentsData = [] } = useQuery({
    queryKey: ['z-report-payments', targetShiftId, salesData.length],
    queryFn: async () => {
      const saleIds = salesData.map(s => s.id);
      if (saleIds.length === 0) return [];
      const { data, error } = await supabase
        .from('payments')
        .select('payment_method, amount')
        .in('sale_id', saleIds);
      if (error) throw error;
      return data || [];
    },
    enabled: salesData.length > 0,
  });

  // Fetch returns during shift
  const { data: returnsData = [] } = useQuery({
    queryKey: ['z-report-returns', targetShiftId, shiftData?.opened_at],
    queryFn: async () => {
      if (!shiftData) return [];
      const query = supabase
        .from('returns')
        .select('refund_amount, refund_method, reason')
        .eq('processed_by', shiftData.cashier_id)
        .gte('created_at', shiftData.opened_at);
      if (shiftData.closed_at) {
        query.lte('created_at', shiftData.closed_at);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!shiftData,
  });

  // Fetch voided sales
  const voidedSales = salesData.filter(s => s.payment_status === 'voided');
  const completedSales = salesData.filter(s => s.payment_status === 'completed');

  // Calculate totals
  const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const totalSubtotal = completedSales.reduce((sum, s) => sum + Number(s.subtotal), 0);
  const totalTax = completedSales.reduce((sum, s) => sum + Number(s.tax_amount || 0), 0);
  const totalDiscount = completedSales.reduce((sum, s) => sum + Number(s.discount_amount || 0), 0);
  const totalCost = completedSales.reduce((sum, s) => sum + Number(s.cost_total || 0), 0);
  const totalProfit = completedSales.reduce((sum, s) => sum + Number(s.profit_total || 0), 0);
  const totalRefunds = returnsData.reduce((sum, r) => sum + Number(r.refund_amount), 0);
  const totalVoided = voidedSales.reduce((sum, s) => sum + Number(s.total_amount), 0);

  // Payment breakdown
  const cashPayments = paymentsData.filter(p => p.payment_method === 'cash').reduce((sum, p) => sum + Number(p.amount), 0);
  const mpesaPayments = paymentsData.filter(p => p.payment_method === 'mpesa').reduce((sum, p) => sum + Number(p.amount), 0);
  const cardPayments = paymentsData.filter(p => p.payment_method === 'card').reduce((sum, p) => sum + Number(p.amount), 0);
  const qrPayments = paymentsData.filter(p => p.payment_method === 'qr').reduce((sum, p) => sum + Number(p.amount), 0);
  const creditPayments = paymentsData.filter(p => p.payment_method === 'credit').reduce((sum, p) => sum + Number(p.amount), 0);

  const openingFloat = shiftData?.opening_float || 0;
  const expectedCash = shiftData?.expected_cash ?? (openingFloat + cashPayments - totalRefunds);
  const actualCash = shiftData?.actual_cash;
  const discrepancy = shiftData?.cash_discrepancy ?? (actualCash != null ? actualCash - expectedCash : null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Z-Report - ${format(new Date(), 'yyyy-MM-dd')}</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 16px; }
            .header { text-align: center; margin-bottom: 12px; }
            .header h1 { font-size: 16px; margin: 4px 0; }
            .header p { margin: 2px 0; font-size: 11px; }
            .separator { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; padding: 2px 0; }
            .row.bold { font-weight: bold; }
            .row.indent { padding-left: 12px; }
            .section-title { font-weight: bold; margin-top: 8px; margin-bottom: 4px; text-transform: uppercase; font-size: 11px; }
            .discrepancy-ok { }
            .discrepancy-bad { font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (!shiftData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Z-Report (End of Shift)
          </DialogTitle>
        </DialogHeader>

        {/* Screen version */}
        <div className="space-y-4">
          {/* Header Info */}
          <div className="text-center space-y-1">
            <h3 className="font-bold text-lg">{currentBranch?.name || 'Branch'}</h3>
            <p className="text-sm text-muted-foreground">Z-Report / Shift Summary</p>
            <div className="flex justify-center">
              <Badge variant={shiftData.status === 'closed' ? 'secondary' : 'default'}>
                {shiftData.status === 'closed' ? 'Closed' : 'Active'}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Shift Details */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cashier</span>
              <span className="font-medium">{cashierProfile?.full_name || cashierProfile?.email || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Opened</span>
              <span className="font-mono text-xs">{format(new Date(shiftData.opened_at), 'MMM d, yyyy h:mm a')}</span>
            </div>
            {shiftData.closed_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Closed</span>
                <span className="font-mono text-xs">{format(new Date(shiftData.closed_at), 'MMM d, yyyy h:mm a')}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Sales Summary */}
          <div>
            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Sales Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Total Transactions</span>
                <span className="font-bold">{completedSales.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Gross Sales</span>
                <span className="font-mono">KES {totalSubtotal.toLocaleString()}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-warning">
                  <span className="pl-3">Discounts</span>
                  <span className="font-mono">-KES {totalDiscount.toLocaleString()}</span>
                </div>
              )}
              {totalTax > 0 && (
                <div className="flex justify-between">
                  <span className="pl-3">Tax Collected</span>
                  <span className="font-mono">KES {totalTax.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Net Sales</span>
                <span className="font-mono">KES {totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Breakdown */}
          <div>
            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Payment Breakdown</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2"><Wallet className="w-3 h-3" /> Cash</span>
                <span className="font-mono">KES {cashPayments.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2"><Smartphone className="w-3 h-3" /> M-Pesa</span>
                <span className="font-mono">KES {mpesaPayments.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-2"><CreditCard className="w-3 h-3" /> Card</span>
                <span className="font-mono">KES {cardPayments.toLocaleString()}</span>
              </div>
              {qrPayments > 0 && (
                <div className="flex justify-between items-center">
                  <span className="pl-5">QR Payment</span>
                  <span className="font-mono">KES {qrPayments.toLocaleString()}</span>
                </div>
              )}
              {creditPayments > 0 && (
                <div className="flex justify-between items-center">
                  <span className="pl-5">Credit</span>
                  <span className="font-mono">KES {creditPayments.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Refunds & Voids */}
          {(totalRefunds > 0 || voidedSales.length > 0) && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Refunds & Voids</h4>
                <div className="space-y-1 text-sm">
                  {totalRefunds > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span className="flex items-center gap-2"><RotateCcw className="w-3 h-3" /> Refunds ({returnsData.length})</span>
                      <span className="font-mono">-KES {totalRefunds.toLocaleString()}</span>
                    </div>
                  )}
                  {voidedSales.length > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span className="flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> Voided ({voidedSales.length})</span>
                      <span className="font-mono">-KES {totalVoided.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Cash Reconciliation */}
          <div>
            <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Cash Reconciliation</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Opening Float</span>
                <span className="font-mono">KES {openingFloat.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>+ Cash Sales</span>
                <span className="font-mono">KES {cashPayments.toLocaleString()}</span>
              </div>
              {totalRefunds > 0 && (
                <div className="flex justify-between">
                  <span>- Cash Refunds</span>
                  <span className="font-mono">-KES {totalRefunds.toLocaleString()}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between font-bold">
                <span>Expected Cash</span>
                <span className="font-mono">KES {expectedCash.toLocaleString()}</span>
              </div>
              {actualCash != null && (
                <>
                  <div className="flex justify-between font-bold">
                    <span>Actual Cash</span>
                    <span className="font-mono">KES {actualCash.toLocaleString()}</span>
                  </div>
                  <div className={cn(
                    "flex justify-between items-center font-bold p-2 rounded-lg mt-1",
                    discrepancy === 0 ? "bg-green-500/10 text-green-700" :
                    (discrepancy ?? 0) > 0 ? "bg-blue-500/10 text-blue-700" :
                    "bg-red-500/10 text-red-700"
                  )}>
                    <span className="flex items-center gap-1">
                      {discrepancy === 0 ? <CheckCircle className="w-4 h-4" /> :
                       (discrepancy ?? 0) > 0 ? <TrendingUp className="w-4 h-4" /> :
                       <TrendingDown className="w-4 h-4" />}
                      {discrepancy === 0 ? 'Balanced' : 'Discrepancy'}
                    </span>
                    <span className="font-mono">
                      {discrepancy !== 0 && (discrepancy ?? 0) > 0 ? '+' : ''}
                      KES {(discrepancy ?? 0).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Profit Summary (for managers) */}
          {totalCost > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Profit Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Cost of Goods Sold</span>
                    <span className="font-mono">KES {totalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-green-600">
                    <span>Gross Profit</span>
                    <span className="font-mono">KES {totalProfit.toLocaleString()}</span>
                  </div>
                  {totalRevenue > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Margin</span>
                      <span>{((totalProfit / totalRevenue) * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {shiftData.notes && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Notes</h4>
                <p className="text-sm text-muted-foreground italic">"{shiftData.notes}"</p>
              </div>
            </>
          )}
        </div>

        {/* Print-only content (hidden) */}
        <div className="hidden">
          <div ref={printRef}>
            <div className="header">
              <h1>{currentBranch?.name || 'Branch'}</h1>
              <p>Z-REPORT / END OF SHIFT</p>
              <p>{format(new Date(), 'MMM d, yyyy h:mm a')}</p>
            </div>
            <div className="separator" />
            <div className="row"><span>Cashier:</span><span>{cashierProfile?.full_name || 'Unknown'}</span></div>
            <div className="row"><span>Opened:</span><span>{format(new Date(shiftData.opened_at), 'h:mm a')}</span></div>
            {shiftData.closed_at && <div className="row"><span>Closed:</span><span>{format(new Date(shiftData.closed_at), 'h:mm a')}</span></div>}
            <div className="separator" />
            <div className="section-title">SALES SUMMARY</div>
            <div className="row"><span>Transactions:</span><span>{completedSales.length}</span></div>
            <div className="row bold"><span>Net Sales:</span><span>KES {totalRevenue.toLocaleString()}</span></div>
            <div className="separator" />
            <div className="section-title">PAYMENTS</div>
            <div className="row"><span>Cash:</span><span>KES {cashPayments.toLocaleString()}</span></div>
            <div className="row"><span>M-Pesa:</span><span>KES {mpesaPayments.toLocaleString()}</span></div>
            <div className="row"><span>Card:</span><span>KES {cardPayments.toLocaleString()}</span></div>
            {totalRefunds > 0 && (
              <>
                <div className="separator" />
                <div className="row"><span>Refunds:</span><span>-KES {totalRefunds.toLocaleString()}</span></div>
              </>
            )}
            <div className="separator" />
            <div className="section-title">CASH RECONCILIATION</div>
            <div className="row"><span>Opening Float:</span><span>KES {openingFloat.toLocaleString()}</span></div>
            <div className="row"><span>+ Cash Sales:</span><span>KES {cashPayments.toLocaleString()}</span></div>
            <div className="row bold"><span>Expected:</span><span>KES {expectedCash.toLocaleString()}</span></div>
            {actualCash != null && (
              <>
                <div className="row bold"><span>Actual:</span><span>KES {actualCash.toLocaleString()}</span></div>
                <div className={`row bold ${discrepancy === 0 ? 'discrepancy-ok' : 'discrepancy-bad'}`}>
                  <span>Difference:</span><span>KES {(discrepancy ?? 0).toLocaleString()}</span>
                </div>
              </>
            )}
            <div className="separator" />
            <div className="header"><p>*** END OF Z-REPORT ***</p></div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
          <Button onClick={handlePrint} className="flex-1">
            <Printer className="w-4 h-4 mr-2" />
            Print Z-Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ZReport;
