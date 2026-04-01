import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useOfflineDB } from '@/hooks/useOfflineDB';
import { usePrinter } from '@/hooks/usePrinter';
import { useTaxSettings } from '@/hooks/useTaxSettings';
import { useShift } from '@/hooks/useShift';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useTransactionRecovery } from '@/hooks/useTransactionRecovery';
import ProductGrid from '@/components/pos/ProductGrid';
import Cart, { CartItem } from '@/components/pos/Cart';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptModal from '@/components/pos/ReceiptModal';
import MobileCartSheet from '@/components/pos/MobileCartSheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { ReceiptData } from '@/lib/escpos';
import { ShoppingCart, Wifi, WifiOff, RefreshCw, Menu, Store, LogOut, Settings } from 'lucide-react';
import BottomNav from '@/components/layout/BottomNav';
import { Link, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { currentBranch } = useBranch();
  const { isOnline, pendingCount, isSyncing, saveSaleOffline, syncPendingSales } = useOfflineSync();
  const { refreshLocalData } = useOfflineDB();
  const { printReceipt, hasPrinter } = usePrinter();
  const { calculateTax } = useTaxSettings();
  const { currentShift } = useShift();
  const { log } = useAuditLog();
  const { saveCheckpoint, clearCheckpoint } = useTransactionRecovery();
  const navigate = useNavigate();
  const lastSaleItemsRef = useRef<CartItem[]>([]);
  const [productRefreshKey, setProductRefreshKey] = useState(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [lastSaleTotal, setLastSaleTotal] = useState({ subtotal: 0, tax: 0, discount: 0, total: 0 });
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [lastSale, setLastSale] = useState<{
    receiptNumber: string;
    payments: Array<{ method: string; amount: number; mpesa_reference?: string }>;
  } | null>(null);

  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const { tax, total: calculatedTotal } = calculateTax(subtotal);
  const discount = 0;
  const total = calculatedTotal - discount;

  const handleProductSelect = useCallback((product: { id: string; name: string; unit_price: number; stock?: number }) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      const currentQtyInCart = existing?.quantity || 0;
      const availableStock = product.stock ?? 0;

      if (availableStock <= 0) {
        toast.error('Out of stock');
        return prev;
      }

      if (currentQtyInCart >= availableStock) {
        toast.error(`Only ${availableStock} in stock`);
        return prev;
      }

      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price, maxStock: availableStock }
            : item
        );
      }
      return [...prev, {
        id: `cart_${Date.now()}`,
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
      setCartItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, quantity, total: quantity * item.unit_price } : item
        )
      );
    }
  }, []);

  const handleRemoveItem = useCallback((itemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const handleClearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const handleCheckout = useCallback(() => {
    if (cartItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    // Save checkpoint for crash recovery
    if (currentBranch?.id && user?.id) {
      saveCheckpoint({
        id: `txn_${Date.now()}`,
        stage: 'payment_started',
        cartItems,
        branchId: currentBranch.id,
        cashierId: user.id,
      });
    }
    setShowPayment(true);
  }, [cartItems, currentBranch?.id, user?.id, saveCheckpoint]);

  const autoPrintReceipt = useCallback(async (
    receiptNumber: string,
    items: CartItem[],
    saleSubtotal: number,
    saleTax: number,
    saleDiscount: number,
    saleTotal: number,
    payments: Array<{ method: string; amount: number; mpesa_reference?: string }>
  ) => {
    if (!hasPrinter || !currentBranch) return;
    const receiptData: ReceiptData = {
      header: {
        businessName: 'DukaOS',
        branchName: currentBranch.name,
        address: currentBranch.address || undefined,
        city: currentBranch.city || undefined,
        phone: currentBranch.phone || undefined,
        email: currentBranch.email || undefined,
        mpesaTill: currentBranch.mpesa_till_number || undefined,
        mpesaPaybill: currentBranch.mpesa_paybill_number || undefined,
        mpesaAccount: currentBranch.mpesa_account_number || undefined,
        kraPin: currentBranch.kra_pin || undefined,
      },
      receiptNumber,
      date: new Date(),
      items: items.map(item => ({ name: item.name, quantity: item.quantity, unitPrice: item.unit_price, totalPrice: item.total })),
      subtotal: saleSubtotal,
      taxAmount: saleTax,
      discountAmount: saleDiscount,
      totalAmount: saleTotal,
      payments: payments.map(p => ({ method: p.method.toUpperCase(), amount: p.amount, reference: p.mpesa_reference })),
      footer: { message: currentBranch.receipt_footer_message || 'Thank you!' },
    };
    const success = await printReceipt(receiptData);
    if (success) toast.success('Receipt printed');
  }, [hasPrinter, currentBranch, printReceipt]);

  const handleConfirmPayment = async (payments: Array<{ method: string; amount: number; mpesa_reference?: string; mpesa_phone?: string; customer_id?: string }>) => {
    if (!currentBranch?.id || !user?.id) {
      toast.error('Please select a branch');
      return;
    }

    const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}`;
    const saleItems = [...cartItems];
    const saleSubtotal = subtotal;
    const saleTax = tax;
    const saleDiscount = discount;
    const saleTotal = total;

    const creditPayment = payments.find(p => p.method === 'credit');
    await saveSaleOffline({
      branch_id: currentBranch.id,
      cashier_id: user.id,
      receipt_number: receiptNumber,
      customer_id: creditPayment?.customer_id || null,
      items: saleItems.map(item => ({
        product_id: item.product_id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: item.total
      })),
      payments: payments.map(p => ({
        payment_method: p.method,
        amount: p.amount,
        mpesa_reference: p.mpesa_reference,
        mpesa_phone: p.mpesa_phone,
        customer_id: p.customer_id,
      })),
      subtotal: saleSubtotal,
      tax_amount: saleTax,
      discount_amount: saleDiscount,
      total_amount: saleTotal,
      shift_id: currentShift?.id || null,
      status: 'completed',
      created_at: new Date().toISOString(),
    });

    lastSaleItemsRef.current = saleItems;
    setLastSaleTotal({ subtotal: saleSubtotal, tax: saleTax, discount: saleDiscount, total: saleTotal });
    setLastSale({ receiptNumber, payments });
    setShowPayment(false);
    setShowMobileCart(false);
    setShowReceipt(true);
    setCartItems([]);
    setProductRefreshKey(k => k + 1);
    clearCheckpoint();
    refreshLocalData();
    autoPrintReceipt(receiptNumber, saleItems, saleSubtotal, saleTax, saleDiscount, saleTotal, payments);

    if (isOnline) {
      toast.success('Sale completed!');
      syncPendingSales();
      log('SALE_COMPLETED', 'sale', receiptNumber, undefined, { receiptNumber, total: saleTotal, items: saleItems.length });
    } else {
      toast.success('Sale saved offline');
    }
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Minimal Status Bar */}
      {(!isOnline || pendingCount > 0) && (
        <div className={`flex items-center justify-between px-3 py-1.5 text-xs font-medium text-white ${!isOnline ? 'bg-destructive' : 'bg-warning'}`}>
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <><WifiOff className="w-3.5 h-3.5" /><span>OFFLINE — sales saved locally</span></>
            ) : isSyncing ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Syncing {pendingCount} transactions...</span></>
            ) : (
              <><RefreshCw className="w-3.5 h-3.5" /><span>{pendingCount} pending sync</span></>
            )}
          </div>
          {isOnline && pendingCount > 0 && !isSyncing && (
            <button onClick={() => syncPendingSales()} className="text-xs underline">Sync Now</button>
          )}
        </div>
      )}

      {/* Compact Header */}
      <header className="bg-card border-b border-border flex items-center justify-between h-12 px-3 shrink-0">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
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
          {currentBranch && (
            <span className="text-xs text-muted-foreground hidden sm:inline">• {currentBranch.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          )}
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Products (60% on desktop, full on mobile) */}
        <div className="flex-1 lg:w-[60%] overflow-hidden flex flex-col">
          <div className="flex-1 p-3 overflow-hidden">
            <ProductGrid refreshKey={productRefreshKey} onProductSelect={handleProductSelect} />
          </div>
        </div>

        {/* RIGHT: Cart (40% on desktop, hidden on mobile) */}
        <div className="hidden lg:flex lg:w-[40%] max-w-[480px] border-l border-border bg-card flex-col">
          <div className="flex-1 p-4 overflow-hidden flex flex-col">
            <Cart
              items={cartItems}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              subtotal={subtotal}
              tax={tax}
              discount={discount}
              total={total}
              onCheckout={handleCheckout}
            />
          </div>
        </div>
      </div>

      {/* Mobile: Floating cart button + total bar */}
      <div className="lg:hidden fixed bottom-20 right-4 z-40">
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg relative"
          onClick={() => setShowMobileCart(true)}
        >
          <ShoppingCart className="w-6 h-6" />
          {cartItemCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {cartItemCount}
            </Badge>
          )}
        </Button>
      </div>

      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-36 left-4 right-4 z-30">
          <Button
            className="w-full h-12 rounded-xl shadow-lg justify-between px-4 bg-primary text-primary-foreground"
            onClick={() => setShowMobileCart(true)}
          >
            <span className="font-medium">{cartItemCount} items</span>
            <span className="font-bold text-lg">KES {total.toLocaleString()}</span>
          </Button>
        </div>
      )}

      {/* Mobile Cart Sheet */}
      <MobileCartSheet
        isOpen={showMobileCart}
        onClose={() => setShowMobileCart(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        subtotal={subtotal}
        tax={tax}
        discount={discount}
        total={total}
        onCheckout={handleCheckout}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        total={total}
        onConfirmPayment={handleConfirmPayment}
      />

      {/* Receipt Modal */}
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
