import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePrinter } from '@/hooks/usePrinter';
import { useTaxSettings } from '@/hooks/useTaxSettings';
import { useShift } from '@/hooks/useShift';
import { useTransactionRecovery } from '@/hooks/useTransactionRecovery';
import ProductGrid from '@/components/pos/ProductGrid';
import Cart, { CartItem } from '@/components/pos/Cart';
import ReceiptModal from '@/components/pos/ReceiptModal';
import MobileCartSheet from '@/components/pos/MobileCartSheet';
import MpesaDialog from '@/components/pos/MpesaDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { ReceiptData } from '@/lib/escpos';
import { ShoppingCart, WifiOff, RefreshCw, Menu, LogOut, Settings } from 'lucide-react';
import BottomNav from '@/components/layout/BottomNav';
import { Link, useNavigate } from 'react-router-dom';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { playBeep } from '@/lib/audio';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { currentBranch } = useBranch();
  const { isOnline, pendingCount, isSyncing, saveSaleOffline, syncPendingSales } = useOfflineSync();
  const { refreshLocalData } = useOfflineDB();
  const { printReceipt, hasPrinter } = usePrinter();
  const { calculateTax } = useTaxSettings();
  const { currentShift } = useShift();
  const { clearCheckpoint } = useTransactionRecovery();
  const navigate = useNavigate();
  const lastSaleItemsRef = useRef<CartItem[]>([]);
  const completingRef = useRef(false);
  const [productRefreshKey, setProductRefreshKey] = useState(0);
  // Cart persistence — survive crashes & refreshes
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('pos_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [lastSaleTotal, setLastSaleTotal] = useState({ subtotal: 0, tax: 0, discount: 0, total: 0 });
  const [showReceipt, setShowReceipt] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showMpesa, setShowMpesa] = useState(false);
  const [lastSale, setLastSale] = useState<{
    receiptNumber: string;
    payments: Array<{ method: string; amount: number; mpesa_reference?: string }>;
  } | null>(null);

  // Persist cart to localStorage on every change
  useEffect(() => {
    try {
      if (cartItems.length > 0) {
        localStorage.setItem('pos_cart', JSON.stringify(cartItems));
      } else {
        localStorage.removeItem('pos_cart');
      }
    } catch {}
  }, [cartItems]);

  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const { tax, total: calculatedTotal } = calculateTax(subtotal);
  const total = calculatedTotal;

  // === PRODUCT TAP — with audio feedback ===
  const handleProductSelect = useCallback((product: { id: string; name: string; unit_price: number; stock?: number }) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      const currentQtyInCart = existing?.quantity || 0;
      const availableStock = product.stock ?? 0;

      if (availableStock <= 0) {
        toast.error('OUT OF STOCK', { duration: 1500 });
        return prev;
      }
      if (currentQtyInCart >= availableStock) {
        toast.error(`Only ${availableStock} in stock`, { duration: 1500 });
        return prev;
      }

      // Audio feedback
      playBeep();

      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price, maxStock: availableStock }
            : item
        );
      }
      return [...prev, {
        id: `c${Date.now()}`,
        product_id: product.id,
        name: product.name,
        unit_price: product.unit_price,
        quantity: 1,
        total: product.unit_price,
        maxStock: availableStock
      }];
    });
  }, []);

  const handleUpdateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity < 1) {
      setCartItems(prev => prev.filter(item => item.id !== itemId));
    } else {
      setCartItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, quantity, total: quantity * item.unit_price } : item
      ));
    }
  }, []);

  const handleRemoveItem = useCallback((itemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const handleClearCart = useCallback(() => setCartItems([]), []);

  // === COMPLETE SALE — uses atomic DB function when online, offline queue when offline ===
  const completeSale = useCallback(async (
    payments: Array<{ method: string; amount: number; mpesa_reference?: string; mpesa_phone?: string }>
  ) => {
    if (completingRef.current) return;
    if (cartItems.length === 0) return;
    if (!currentBranch?.id || !user?.id) { toast.error('Select a branch'); return; }

    completingRef.current = true;
    const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}`;
    const saleItems = [...cartItems];
    const saleSubtotal = subtotal;
    const saleTax = tax;
    const saleTotal = total;

    try {
      if (navigator.onLine) {
        // === ONLINE: Use atomic complete_sale RPC (concurrency-safe) ===
        const { data, error } = await supabase.rpc('complete_sale', {
          p_branch_id: currentBranch.id,
          p_cashier_id: user.id,
          p_receipt_number: receiptNumber,
          p_customer_id: null,
          p_shift_id: currentShift?.id || null,
          p_subtotal: saleSubtotal,
          p_tax_amount: saleTax,
          p_discount_amount: 0,
          p_total_amount: saleTotal,
          p_cost_total: 0,
          p_profit_total: 0,
          p_notes: null,
          p_items: saleItems.map(item => ({
            product_id: item.product_id,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_amount: item.total,
            discount_amount: 0,
            tax_amount: 0,
          })),
          p_payments: payments.map(p => ({
            payment_method: p.method,
            amount: p.amount,
            mpesa_reference: p.mpesa_reference || null,
            mpesa_phone: p.mpesa_phone || null,
          })),
          p_offline_id: null,
        });

        if (error) {
          // If server rejects (e.g. insufficient stock), show error and abort
          toast.error(error.message || 'Sale failed', { duration: 3000 });
          return;
        }
      } else {
        // === OFFLINE: Queue for later sync ===
        await saveSaleOffline({
          branch_id: currentBranch.id,
          cashier_id: user.id,
          receipt_number: receiptNumber,
          customer_id: null,
          items: saleItems.map(item => ({
            product_id: item.product_id, product_name: item.name,
            quantity: item.quantity, unit_price: item.unit_price, total_amount: item.total
          })),
          payments: payments.map(p => ({
            payment_method: p.method, amount: p.amount,
            mpesa_reference: p.mpesa_reference, mpesa_phone: p.mpesa_phone,
          })),
          subtotal: saleSubtotal, tax_amount: saleTax, discount_amount: 0,
          total_amount: saleTotal, shift_id: currentShift?.id || null,
          status: 'completed', created_at: new Date().toISOString(),
        });
      }

      lastSaleItemsRef.current = saleItems;
      setLastSaleTotal({ subtotal: saleSubtotal, tax: saleTax, discount: 0, total: saleTotal });
      setLastSale({ receiptNumber, payments });
      setShowMobileCart(false);
      setShowMpesa(false);
      setShowReceipt(true);
      setCartItems([]);
      setProductRefreshKey(k => k + 1);
      clearCheckpoint();

      // Auto-print
      if (hasPrinter && currentBranch) {
        const receiptData: ReceiptData = {
          header: {
            businessName: 'DukaOS', branchName: currentBranch.name,
            address: currentBranch.address || undefined, city: currentBranch.city || undefined,
            phone: currentBranch.phone || undefined, mpesaTill: currentBranch.mpesa_till_number || undefined,
            mpesaPaybill: currentBranch.mpesa_paybill_number || undefined,
            kraPin: currentBranch.kra_pin || undefined,
          },
          receiptNumber, date: new Date(),
          items: saleItems.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unit_price, totalPrice: i.total })),
          subtotal: saleSubtotal, taxAmount: saleTax, discountAmount: 0, totalAmount: saleTotal,
          payments: payments.map(p => ({ method: p.method.toUpperCase(), amount: p.amount, reference: p.mpesa_reference })),
          footer: { message: currentBranch.receipt_footer_message || 'Thank you!' },
        };
        printReceipt(receiptData);
      }

      toast.success(navigator.onLine ? 'Sale completed!' : 'Saved offline', { duration: 1500 });
    } finally {
      completingRef.current = false;
    }
  }, [cartItems, subtotal, tax, total, currentBranch, user, currentShift, saveSaleOffline, clearCheckpoint, hasPrinter, printReceipt]);

  // === INSTANT CASH — one tap, no modal ===
  const handleCashPayment = useCallback((cashAmount?: number) => {
    const amt = cashAmount ?? total;
    if (amt < total) { toast.error('Insufficient amount'); return; }
    const change = amt - total;
    completeSale([{ method: 'cash', amount: total }]);
    if (change > 0) {
      toast.info(`Change: KES ${change.toLocaleString()}`, { duration: 4000 });
    }
  }, [total, completeSale]);

  const handleCardPayment = useCallback(() => {
    completeSale([{ method: 'card', amount: total }]);
  }, [total, completeSale]);

  const handleMpesaComplete = useCallback((phone: string, reference: string) => {
    completeSale([{ method: 'mpesa', amount: total, mpesa_phone: phone, mpesa_reference: reference }]);
  }, [total, completeSale]);

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Offline/sync bar */}
      {(!isOnline || pendingCount > 0) && (
        <div className={`flex items-center justify-between px-3 py-1 text-xs font-medium text-white ${!isOnline ? 'bg-destructive' : 'bg-warning'}`}>
          <div className="flex items-center gap-1.5">
            {!isOnline ? <><WifiOff className="w-3 h-3" /><span>OFFLINE</span></> :
              isSyncing ? <><RefreshCw className="w-3 h-3 animate-spin" /><span>Syncing...</span></> :
              <><RefreshCw className="w-3 h-3" /><span>{pendingCount} pending</span></>}
          </div>
          {isOnline && pendingCount > 0 && !isSyncing && (
            <button onClick={() => syncPendingSales()} className="underline">Sync</button>
          )}
        </div>
      )}

      {/* Header — minimal */}
      <header className="bg-card border-b border-border flex items-center justify-between h-11 px-3 shrink-0">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"><Menu className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem asChild><Link to="/inventory">Inventory</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/customers">Customers</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/reports">Reports</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/settings"><Settings className="h-4 w-4 mr-2" />Settings</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await signOut(); navigate('/auth'); }} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="font-bold text-sm">DukaOS</span>
          {currentBranch && <span className="text-[10px] text-muted-foreground hidden sm:inline">• {currentBranch.name}</span>}
        </div>
        {isOnline ? <div className="w-2 h-2 rounded-full bg-success" /> : <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />}
      </header>

      {/* Split layout */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 lg:w-[60%] overflow-hidden flex flex-col">
          <div className="flex-1 p-2 lg:p-3 overflow-hidden">
            <ProductGrid refreshKey={productRefreshKey} onProductSelect={handleProductSelect} />
          </div>
        </div>

        {/* Desktop cart — always visible */}
        <div className="hidden lg:flex lg:w-[40%] max-w-[480px] border-l border-border bg-card flex-col">
          <div className="flex-1 p-3 overflow-hidden flex flex-col">
            <Cart
              items={cartItems}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              subtotal={subtotal}
              tax={tax}
              total={total}
              onCashPayment={handleCashPayment}
              onCardPayment={handleCardPayment}
              onMpesaPayment={() => setShowMpesa(true)}
            />
          </div>
        </div>
      </div>

      {/* Mobile floating cart */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-20 left-3 right-3 z-40">
          <Button
            className="w-full h-14 rounded-xl shadow-lg justify-between px-5 bg-primary text-primary-foreground"
            onClick={() => setShowMobileCart(true)}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground text-xs">{cartItemCount}</Badge>
            </div>
            <span className="font-black text-xl tabular-nums">KES {total.toLocaleString()}</span>
          </Button>
        </div>
      )}

      {/* Mobile cart sheet */}
      <MobileCartSheet
        isOpen={showMobileCart}
        onClose={() => setShowMobileCart(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        subtotal={subtotal}
        tax={tax}
        total={total}
        onCashPayment={handleCashPayment}
        onCardPayment={handleCardPayment}
        onMpesaPayment={() => setShowMpesa(true)}
      />

      {/* M-Pesa dialog — only modal left */}
      <MpesaDialog
        isOpen={showMpesa}
        onClose={() => setShowMpesa(false)}
        total={total}
        onComplete={handleMpesaComplete}
      />

      {/* Receipt */}
      {lastSale && (
        <ReceiptModal
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          receiptNumber={lastSale.receiptNumber}
          items={lastSaleItemsRef.current}
          subtotal={lastSaleTotal.subtotal}
          tax={lastSaleTotal.tax}
          discount={lastSaleTotal.discount}
          total={lastSaleTotal.total}
          payments={lastSale.payments}
          branchName={currentBranch?.name}
          branchAddress={currentBranch?.address}
          branchCity={currentBranch?.city}
          branchPhone={currentBranch?.phone}
          mpesaTill={currentBranch?.mpesa_till_number}
          mpesaPaybill={currentBranch?.mpesa_paybill_number}
          mpesaAccount={currentBranch?.mpesa_account_number}
          kraPin={currentBranch?.kra_pin}
          footerMessage={currentBranch?.receipt_footer_message || 'Thank you!'}
        />
      )}

      <BottomNav />
    </div>
  );
};

export default Dashboard;
