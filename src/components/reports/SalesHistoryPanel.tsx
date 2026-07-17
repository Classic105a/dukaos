import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  MoreVertical,
  Eye,
  Printer,
  RotateCcw,
  Undo2,
  Download,
  Share2,
  FileText,
  Loader2,
  Search,
  User,
  CreditCard,
  CheckCircle2,
  XCircle,
  Filter,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBranch } from '@/hooks/useBranch';
import { usePrinter } from '@/hooks/usePrinter';
import { buildReprintPayload } from '@/lib/reprint-receipt';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import ReceiptViewerDialog from './ReceiptViewerDialog';
import ReturnModal from '@/components/pos/ReturnModal';

interface SalesHistoryPanelProps {
  sales: any[];
  loading: boolean;
}

const PAGE_SIZE = 25;

const SalesHistoryPanel = ({ sales, loading }: SalesHistoryPanelProps) => {
  const { currentBranch, branches } = useBranch();
  const { printReceipt, isPrinting: printerBusy } = usePrinter();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'refunded'>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'mpesa' | 'card' | 'credit'>('all');
  const [page, setPage] = useState(1);

  const [viewSaleId, setViewSaleId] = useState<string | null>(null);
  const [refundSaleId, setRefundSaleId] = useState<string | null>(null);
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('partial');
  const [detailsSaleId, setDetailsSaleId] = useState<string | null>(null);

  const [reprintingId, setReprintingId] = useState<string | null>(null);

  const saleIds = useMemo(() => sales.map(s => s.id), [sales]);
  const cashierIds = useMemo(
    () => Array.from(new Set(sales.map(s => s.cashier_id).filter(Boolean))),
    [sales]
  );
  const customerIds = useMemo(
    () => Array.from(new Set(sales.map(s => s.customer_id).filter(Boolean))),
    [sales]
  );

  // Supplementary data — refunds
  const { data: returnsRows = [] } = useQuery({
    queryKey: ['sales-history-returns', saleIds],
    enabled: saleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('returns' as any)
        .select('id, original_sale_id, refund_amount, status, created_at')
        .in('original_sale_id', saleIds);
      if (error) throw error;
      return (data || []) as Array<{ id: string; original_sale_id: string; refund_amount: number; status: string; created_at: string }>;
    },
    staleTime: 30_000,
  });

  // Supplementary — payments (for filter + display)
  const { data: paymentsRows = [] } = useQuery({
    queryKey: ['sales-history-payments', saleIds],
    enabled: saleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('sale_id, payment_method, amount')
        .in('sale_id', saleIds);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  // Supplementary — cashier names
  const { data: cashierMap = {} } = useQuery({
    queryKey: ['sales-history-cashiers', cashierIds],
    enabled: cashierIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', cashierIds);
      if (error) throw error;
      const map: Record<string, { name: string }> = {};
      (data || []).forEach(p => { map[p.id] = { name: p.full_name || p.email || '—' }; });
      return map;
    },
    staleTime: 60_000,
  });

  // Supplementary — customer names
  const { data: customerMap = {} } = useQuery({
    queryKey: ['sales-history-customers', customerIds],
    enabled: customerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds);
      if (error) throw error;
      const map: Record<string, { name: string }> = {};
      (data || []).forEach(c => { map[c.id] = { name: c.name || '—' }; });
      return map;
    },
    staleTime: 60_000,
  });

  const refundBySale: Record<string, { total: number; count: number }> = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    returnsRows.forEach(r => {
      if (!r.original_sale_id) return;
      const cur = map[r.original_sale_id] || { total: 0, count: 0 };
      cur.total += Number(r.refund_amount || 0);
      cur.count += 1;
      map[r.original_sale_id] = cur;
    });
    return map;
  }, [returnsRows]);

  const methodBySale: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    paymentsRows.forEach(p => {
      // Prefer first non-cash if mixed, else cash
      const cur = map[p.sale_id];
      if (!cur) map[p.sale_id] = p.payment_method;
      else if (cur === 'cash' && p.payment_method !== 'cash') map[p.sale_id] = p.payment_method;
    });
    return map;
  }, [paymentsRows]);

  const branchName = (id: string | null | undefined) =>
    (id && branches.find(b => b.id === id)?.name) || currentBranch?.name || '—';

  // Filter + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales
      .filter(s => {
        // status
        const refundInfo = refundBySale[s.id];
        const isRefunded = !!refundInfo && refundInfo.total > 0;
        if (statusFilter === 'refunded' && !isRefunded) return false;
        if (statusFilter === 'active' && isRefunded) return false;
        // method
        if (methodFilter !== 'all' && (methodBySale[s.id] || '').toLowerCase() !== methodFilter) return false;
        // search
        if (!q) return true;
        const receipt = String(s.receipt_number || '').toLowerCase();
        const customer = (s.customer_id && customerMap[s.customer_id]?.name || '').toLowerCase();
        const cashier = (s.cashier_id && cashierMap[s.cashier_id]?.name || '').toLowerCase();
        const products = (s.sale_items || []).map((i: any) => String(i.product_name || '').toLowerCase()).join(' ');
        return receipt.includes(q) || customer.includes(q) || cashier.includes(q) || products.includes(q);
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [sales, search, statusFilter, methodFilter, refundBySale, methodBySale, cashierMap, customerMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleReprint = async (saleId: string) => {
    setReprintingId(saleId);
    try {
      const { receiptData, receiptHtml } = await buildReprintPayload(saleId, currentBranch);
      const result = await printReceipt(receiptData, { fallbackToBrowser: true, receiptHtml });
      if (result.success && result.method === 'thermal') toast.success('Receipt reprinted');
      else if (!result.success) toast.error(result.error || 'Failed to reprint');
    } catch (err) {
      console.error('Reprint error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to reprint');
    } finally {
      setReprintingId(null);
    }
  };

  const openViewer = (saleId: string) => setViewSaleId(saleId);
  const openFullRefund = (saleId: string) => { setRefundMode('full'); setRefundSaleId(saleId); };
  const openPartialRefund = (saleId: string) => { setRefundMode('partial'); setRefundSaleId(saleId); };

  const handleDownloadPdf = async (saleId: string) => {
    try {
      const { receiptHtml, receiptData } = await buildReprintPayload(saleId, currentBranch);
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${receiptData.receiptNumber}</title></head><body>${receiptHtml}</body></html>`);
      w.document.close();
      setTimeout(() => w.print(), 300);
    } catch (err) {
      console.error(err);
      toast.error('Failed to prepare PDF');
    }
  };

  const handleShare = async (saleId: string) => {
    try {
      const { receiptData } = await buildReprintPayload(saleId, currentBranch);
      const text = `Receipt ${receiptData.receiptNumber}\nDate: ${receiptData.date.toLocaleString()}\nTotal: KES ${Number(receiptData.totalAmount).toLocaleString()}`;
      if (navigator.share) {
        await navigator.share({ title: `Receipt ${receiptData.receiptNumber}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Receipt summary copied');
      }
    } catch (err) {
      if ((err as any)?.name !== 'AbortError') console.warn('Share failed', err);
    }
  };

  const onRefundComplete = () => {
    qc.invalidateQueries({ queryKey: ['sales-report'] });
    qc.invalidateQueries({ queryKey: ['sales-history-returns'] });
    setRefundSaleId(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Sales History</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {filtered.length} of {sales.length} transaction{sales.length === 1 ? '' : 's'} · use the ⋮ menu for actions
              </p>
            </div>
          </div>

          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search receipt, customer, cashier, product…"
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="w-4 h-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={(v: any) => { setMethodFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <CreditCard className="w-4 h-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Loading transactions…</p>
          ) : pageRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No transactions match the current filters</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 px-3 font-medium">Receipt</th>
                      <th className="py-2 px-3 font-medium">Date</th>
                      <th className="py-2 px-3 font-medium">Customer</th>
                      <th className="py-2 px-3 font-medium">Cashier</th>
                      <th className="py-2 px-3 font-medium">Payment</th>
                      <th className="py-2 px-3 font-medium">Branch</th>
                      <th className="py-2 px-3 font-medium text-right">Total</th>
                      <th className="py-2 px-3 font-medium text-center">Status</th>
                      <th className="py-2 px-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((sale: any) => {
                      const refundInfo = refundBySale[sale.id];
                      const isRefunded = !!refundInfo && refundInfo.total > 0;
                      const fullyRefunded = isRefunded && refundInfo.total >= Number(sale.total_amount);
                      const method = methodBySale[sale.id] || '—';
                      const isBusy = reprintingId === sale.id;
                      return (
                        <tr key={sale.id} className="border-b hover:bg-muted/40 transition-colors">
                          <td className="py-2 px-3 font-mono text-xs">{sale.receipt_number}</td>
                          <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(sale.created_at), 'dd MMM yyyy, HH:mm')}
                          </td>
                          <td className="py-2 px-3 text-xs">
                            {sale.customer_id ? (customerMap[sale.customer_id]?.name || '—') : <span className="text-muted-foreground">Walk-in</span>}
                          </td>
                          <td className="py-2 px-3 text-xs">{sale.cashier_id ? (cashierMap[sale.cashier_id]?.name || '—') : '—'}</td>
                          <td className="py-2 px-3 text-xs capitalize">{method}</td>
                          <td className="py-2 px-3 text-xs">{branchName(sale.branch_id)}</td>
                          <td className="py-2 px-3 text-right font-semibold tabular-nums">
                            KES {Number(sale.total_amount).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {fullyRefunded ? (
                              <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Refunded</Badge>
                            ) : isRefunded ? (
                              <Badge variant="secondary" className="gap-1"><Undo2 className="w-3 h-3" /> Partial</Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Completed</Badge>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openViewer(sale.id)} aria-label="View receipt">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleReprint(sale.id)} disabled={isBusy || printerBusy} aria-label="Reprint receipt">
                                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                              </Button>
                              <RowMenu
                                sale={sale}
                                fullyRefunded={fullyRefunded}
                                onView={() => openViewer(sale.id)}
                                onReprint={() => handleReprint(sale.id)}
                                onFullRefund={() => openFullRefund(sale.id)}
                                onPartialRefund={() => openPartialRefund(sale.id)}
                                onPdf={() => handleDownloadPdf(sale.id)}
                                onShare={() => handleShare(sale.id)}
                                onDetails={() => setDetailsSaleId(sale.id)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {pageRows.map((sale: any) => {
                  const refundInfo = refundBySale[sale.id];
                  const isRefunded = !!refundInfo && refundInfo.total > 0;
                  const fullyRefunded = isRefunded && refundInfo.total >= Number(sale.total_amount);
                  const method = methodBySale[sale.id] || '—';
                  return (
                    <div key={sale.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs truncate">{sale.receipt_number}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(sale.created_at), 'dd MMM, HH:mm')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums text-sm">KES {Number(sale.total_amount).toLocaleString()}</p>
                          {fullyRefunded ? (
                            <Badge variant="destructive" className="mt-1 text-[10px]">Refunded</Badge>
                          ) : isRefunded ? (
                            <Badge variant="secondary" className="mt-1 text-[10px]">Partial refund</Badge>
                          ) : (
                            <Badge variant="outline" className="mt-1 text-[10px]">Completed</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 truncate">
                          <User className="w-3 h-3" />
                          {sale.customer_id ? (customerMap[sale.customer_id]?.name || '—') : 'Walk-in'}
                        </span>
                        <span className="capitalize">{method}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1 pt-1">
                        <Button size="sm" variant="outline" onClick={() => openViewer(sale.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReprint(sale.id)} disabled={reprintingId === sale.id || printerBusy}>
                          {reprintingId === sale.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                        </Button>
                        <RowMenu
                          sale={sale}
                          fullyRefunded={fullyRefunded}
                          onView={() => openViewer(sale.id)}
                          onReprint={() => handleReprint(sale.id)}
                          onFullRefund={() => openFullRefund(sale.id)}
                          onPartialRefund={() => openPartialRefund(sale.id)}
                          onPdf={() => handleDownloadPdf(sale.id)}
                          onShare={() => handleShare(sale.id)}
                          onDetails={() => setDetailsSaleId(sale.id)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                  <span>Page {page} of {totalPages}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      Previous
                    </Button>
                    <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Receipt viewer */}
      <ReceiptViewerDialog
        isOpen={!!viewSaleId}
        onClose={() => setViewSaleId(null)}
        saleId={viewSaleId}
        markAsReprint
      />

      {/* Refund (full or partial) — reuses existing ReturnModal */}
      <ReturnModal
        isOpen={!!refundSaleId}
        onClose={() => setRefundSaleId(null)}
        onComplete={onRefundComplete}
        preloadedSaleId={refundSaleId}
        preloadFullRefund={refundMode === 'full'}
      />

      {/* Transaction details */}
      <TransactionDetailsDialog
        saleId={detailsSaleId}
        onClose={() => setDetailsSaleId(null)}
        sales={sales}
        cashierMap={cashierMap}
        customerMap={customerMap}
        methodBySale={methodBySale}
        refundBySale={refundBySale}
        branchName={branchName}
      />
    </>
  );
};

/* ─── Row action menu ─── */
function RowMenu({
  fullyRefunded, onView, onReprint, onFullRefund, onPartialRefund, onPdf, onShare, onDetails,
}: {
  sale: any;
  fullyRefunded: boolean;
  onView: () => void;
  onReprint: () => void;
  onFullRefund: () => void;
  onPartialRefund: () => void;
  onPdf: () => void;
  onShare: () => void;
  onDetails: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" aria-label="More actions">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Transaction</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}><Eye className="w-4 h-4 mr-2" /> View receipt</DropdownMenuItem>
        <DropdownMenuItem onClick={onReprint}><Printer className="w-4 h-4 mr-2" /> Reprint receipt</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Refund</DropdownMenuLabel>
        <DropdownMenuItem onClick={onFullRefund} disabled={fullyRefunded}>
          <RotateCcw className="w-4 h-4 mr-2" /> Refund entire receipt
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPartialRefund} disabled={fullyRefunded}>
          <Undo2 className="w-4 h-4 mr-2" /> Partial refund
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Share</DropdownMenuLabel>
        <DropdownMenuItem onClick={onPdf}><Download className="w-4 h-4 mr-2" /> Download PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={onShare}><Share2 className="w-4 h-4 mr-2" /> Share receipt</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDetails}><FileText className="w-4 h-4 mr-2" /> Transaction details</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── Transaction details dialog ─── */
function TransactionDetailsDialog({
  saleId, onClose, sales, cashierMap, customerMap, methodBySale, refundBySale, branchName,
}: {
  saleId: string | null;
  onClose: () => void;
  sales: any[];
  cashierMap: Record<string, { name: string }>;
  customerMap: Record<string, { name: string }>;
  methodBySale: Record<string, string>;
  refundBySale: Record<string, { total: number; count: number }>;
  branchName: (id: string | null | undefined) => string;
}) {
  const sale = saleId ? sales.find(s => s.id === saleId) : null;
  return (
    <Dialog open={!!saleId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Transaction Details
          </DialogTitle>
        </DialogHeader>
        {sale ? (
          <div className="space-y-3 text-sm">
            <Row label="Receipt" value={<span className="font-mono">{sale.receipt_number}</span>} />
            <Row label="Date" value={format(new Date(sale.created_at), 'dd MMM yyyy, HH:mm')} />
            <Row label="Cashier" value={sale.cashier_id ? cashierMap[sale.cashier_id]?.name || '—' : '—'} />
            <Row label="Customer" value={sale.customer_id ? customerMap[sale.customer_id]?.name || '—' : 'Walk-in'} />
            <Row label="Branch" value={branchName(sale.branch_id)} />
            <Row label="Payment method" value={<span className="capitalize">{methodBySale[sale.id] || '—'}</span>} />
            <div className="border-t pt-2 space-y-1">
              <Row label="Subtotal" value={`KES ${Number(sale.subtotal || 0).toLocaleString()}`} />
              <Row label="Discount" value={`KES ${Number(sale.discount_amount || 0).toLocaleString()}`} />
              <Row label="Tax" value={`KES ${Number(sale.tax_amount || 0).toLocaleString()}`} />
              <Row label="Total" value={<strong>KES {Number(sale.total_amount).toLocaleString()}</strong>} />
              {refundBySale[sale.id] && (
                <Row label="Refunded" value={<span className="text-destructive">KES {Number(refundBySale[sale.id].total).toLocaleString()}</span>} />
              )}
            </div>
            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground mb-2">Items</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {(sale.sale_items || []).map((it: any) => (
                  <div key={it.id} className="flex justify-between text-xs">
                    <span className="truncate mr-2">{it.product_name} × {it.quantity}</span>
                    <span className="tabular-nums">KES {Number(it.total_amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export default SalesHistoryPanel;