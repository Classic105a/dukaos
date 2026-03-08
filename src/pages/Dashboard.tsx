import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePrinter } from '@/hooks/usePrinter';
import { useTaxSettings } from '@/hooks/useTaxSettings';
import { useHoldSale } from '@/hooks/useHoldSale';
import { useShift } from '@/hooks/useShift';
import { useAuditLog } from '@/hooks/useAuditLog';
import ProductGrid from '@/components/pos/ProductGrid';
import Cart, { CartItem } from '@/components/pos/Cart';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptModal from '@/components/pos/ReceiptModal';
import VoidSaleModal from '@/components/pos/VoidSaleModal';
import ReturnModal from '@/components/pos/ReturnModal';
import ReprintReceiptModal from '@/components/pos/ReprintReceiptModal';
import HeldSalesPanel from '@/components/pos/HeldSalesPanel';
import HoldSaleDialog from '@/components/pos/HoldSaleDialog';
import POSHeader from '@/components/pos/POSHeader';
import MobileCartSheet from '@/components/pos/MobileCartSheet';
import OpenShiftDialog from '@/components/shift/OpenShiftDialog';
import CloseShiftDialog from '@/components/shift/CloseShiftDialog';
import ZReport from '@/components/shift/ZReport';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { ReceiptData } from '@/lib/escpos';
import { RotateCcw, Printer, XCircle, PauseCircle, ShoppingCart } from 'lucide-react';
import BottomNav from '@/components/layout/BottomNav';

const Dashboard = () => {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const { isOnline, saveSaleOffline } = useOfflineSync();
  const { printReceipt, hasPrinter } = usePrinter();
  const { calculateTax } = useTaxSettings();
  const { heldSales, holdSale, resumeSale, deleteHeldSale } = useHoldSale();
  const { currentShift, hasOpenShift } = useShift();
  const { log } = useAuditLog();
  const lastSaleItemsRef = useRef<CartItem[]>([]);
  const [productRefreshKey, setProductRefreshKey] = useState(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showZReport, setShowZReport] = useState(false);
  const [lastSaleTotal, setLastSaleTotal] = useState({ subtotal: 0, tax: 0, discount: 0, total: 0 });
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [showHoldDialog, setShowHoldDialog] = useState(false);
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
        toast.error(`Only ${availableStock} available in stock`);
        return prev;
      }
      
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? { 
                ...item, 
                quantity: item.quantity + 1, 
                total: (item.quantity + 1) * item.unit_price,
                maxStock: availableStock 
              }
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
          item.id === itemId
            ? { ...item, quantity, total: quantity * item.unit_price }
            : item
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
        website: currentBranch.website || undefined,
        mpesaTill: currentBranch.mpesa_till_number || undefined,
        mpesaPaybill: currentBranch.mpesa_paybill_number || undefined,
        mpesaAccount: currentBranch.mpesa_account_number || undefined,
        kraPin: currentBranch.kra_pin || undefined,
      },
      receiptNumber,
      date: new Date(),
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total,
      })),
      subtotal: saleSubtotal,
      taxAmount: saleTax,
      discountAmount: saleDiscount,
      totalAmount: saleTotal,
      payments: payments.map(p => ({
        method: p.method.toUpperCase(),
        amount: p.amount,
        reference: p.mpesa_reference,
      })),
      footer: {
        message: currentBranch.receipt_footer_message || 'Thank you for your business!',
      },
    };

    const success = await printReceipt(receiptData);
    if (success) {
      toast.success('Receipt printed');
    }
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

    if (!isOnline) {
      saveSaleOffline({
        branch_id: currentBranch.id,
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
          mpesa_phone: p.mpesa_phone
        })),
        subtotal: saleSubtotal,
        tax_amount: saleTax,
        discount_amount: saleDiscount,
        total_amount: saleTotal,
        created_at: new Date().toISOString()
      });
      
      lastSaleItemsRef.current = saleItems;
      setLastSaleTotal({ subtotal: saleSubtotal, tax: saleTax, discount: saleDiscount, total: saleTotal });
      setLastSale({ receiptNumber, payments });
      setShowPayment(false);
      setShowMobileCart(false);
      setShowReceipt(true);
      setCartItems([]);
      setProductRefreshKey(k => k + 1);
      toast.success('Sale saved offline. Will sync when online.');
      
      autoPrintReceipt(receiptNumber, saleItems, saleSubtotal, saleTax, saleDiscount, saleTotal, payments);
      return;
    }

    try {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          branch_id: currentBranch.id,
          cashier_id: user.id,
          receipt_number: receiptNumber,
          subtotal: saleSubtotal,
          tax_amount: saleTax,
          discount_amount: saleDiscount,
          total_amount: saleTotal,
          payment_status: 'completed',
          shift_id: currentShift?.id || null,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      await supabase.from('sale_items').insert(
        saleItems.map(item => ({
          sale_id: saleData.id,
          product_id: item.product_id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.total
        }))
      );

      const { error: movementError } = await supabase.from('stock_movements').insert(
        saleItems.map(item => ({
          product_id: item.product_id,
          branch_id: currentBranch.id,
          quantity_change: -item.quantity,
          movement_type: 'SALE',
          reference_id: saleData.id,
          created_by: user.id,
          notes: `Sale ${receiptNumber}`,
        }))
      );

      if (movementError) throw movementError;

      // Handle credit payment - record in credit_transactions
      const creditPayment = payments.find(p => p.method === 'credit');
      if (creditPayment && creditPayment.customer_id) {
        // Get customer's current balance
        const { data: customerData } = await supabase
          .from('customers')
          .select('credit_balance')
          .eq('id', creditPayment.customer_id)
          .single();
        
        const newBalance = (customerData?.credit_balance || 0) + saleTotal;
        
        // Record credit transaction
        await supabase.from('credit_transactions').insert({
          customer_id: creditPayment.customer_id,
          sale_id: saleData.id,
          transaction_type: 'CREDIT_SALE',
          amount: saleTotal,
          running_balance: newBalance,
          processed_by: user.id,
          notes: `Sale ${receiptNumber}`,
        });

        // Update customer balance
        await supabase
          .from('customers')
          .update({ credit_balance: newBalance })
          .eq('id', creditPayment.customer_id);

        // Update sale with customer_id
        await supabase
          .from('sales')
          .update({ customer_id: creditPayment.customer_id })
          .eq('id', saleData.id);
      }

      await supabase.from('payments').insert(
        payments.map(p => ({
          sale_id: saleData.id,
          payment_method: p.method,
          amount: p.amount,
          mpesa_reference: p.mpesa_reference || null,
          mpesa_phone: p.mpesa_phone || null,
          status: 'completed'
        }))
      );

      lastSaleItemsRef.current = saleItems;
      setLastSaleTotal({ subtotal: saleSubtotal, tax: saleTax, discount: saleDiscount, total: saleTotal });
      setLastSale({ receiptNumber, payments });
      setShowPayment(false);
      setShowMobileCart(false);
      setShowReceipt(true);
      setCartItems([]);
      setProductRefreshKey(k => k + 1);
      toast.success('Sale completed!');
      
      // Audit log
      log('SALE_COMPLETED', 'sale', saleData.id, undefined, {
        receiptNumber,
        total: saleTotal,
        items: saleItems.length,
      });
      
      autoPrintReceipt(receiptNumber, saleItems, saleSubtotal, saleTax, saleDiscount, saleTotal, payments);
    } catch (error: any) {
      console.error('Sale error:', error);
      
      // Provide user-friendly error messages
      if (error.code === '42501' || error.message?.includes('row-level security')) {
        toast.error('Access denied. Please log out and back in.');
      } else if (error.code === '23503') {
        toast.error('Product or branch not found. Please refresh.');
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        toast.error('Network error. Check your connection.');
      } else {
        toast.error('Failed to complete sale. Please try again.');
      }
    }
  };

  const handleVoidSale = (reason: string) => {
    console.log('Sale voided:', { items: cartItems, reason });
    toast.success('Sale voided');
    setCartItems([]);
    setShowMobileCart(false);
  };

  const handleHoldSale = (customerName?: string) => {
    if (cartItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    holdSale(cartItems, subtotal, tax, discount, total, customerName);
    setCartItems([]);
    setShowMobileCart(false);
    toast.success('Sale held successfully');
  };

  const handleResumeSale = (saleId: string) => {
    if (cartItems.length > 0) {
      holdSale(cartItems, subtotal, tax, discount, total);
      toast.info('Current cart was automatically held');
    }
    
    const sale = resumeSale(saleId);
    if (sale) {
      setCartItems(sale.items);
      toast.success('Sale resumed');
    }
  };

  const handleDeleteHeldSale = (saleId: string) => {
    deleteHeldSale(saleId);
    toast.success('Held sale deleted');
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* POS Header */}
      <POSHeader 
        heldSalesCount={heldSales.length}
        onReturnClick={() => setShowReturnModal(true)}
        onReprintClick={() => setShowReprintModal(true)}
        onOpenShift={() => setShowOpenShift(true)}
        onCloseShift={() => setShowCloseShift(true)}
        onViewZReport={() => setShowZReport(true)}
        heldSalesPanel={
          <HeldSalesPanel
            heldSales={heldSales}
            onResume={handleResumeSale}
            onDelete={handleDeleteHeldSale}
          />
        }
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Product Grid - Full width on mobile, 2/3 on desktop */}
        <div className="flex-1 lg:w-2/3 overflow-hidden flex flex-col">
          <div className="flex-1 p-3 lg:p-4 overflow-hidden">
            <ProductGrid key={productRefreshKey} onProductSelect={handleProductSelect} />
          </div>
        </div>

        {/* Desktop Cart Panel */}
        <div className="hidden lg:flex lg:w-1/3 xl:w-[400px] border-l border-border bg-card flex-col">
          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
            {cartItems.length > 0 && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setShowHoldDialog(true)}
                >
                  <PauseCircle className="w-3.5 h-3.5 mr-1" />
                  Hold
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-xs h-8 text-destructive hover:text-destructive"
                  onClick={() => setShowVoidModal(true)}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Void
                </Button>
              </>
            )}
          </div>
          
          <div className="flex-1 p-4 overflow-hidden">
            <Cart
              items={cartItems}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              subtotal={subtotal}
              tax={tax}
              discount={discount}
              total={total}
              onCheckout={() => setShowPayment(true)}
            />
          </div>
        </div>
      </div>

      {/* Mobile Floating Cart Button — above bottom nav */}
      <div className="lg:hidden fixed bottom-20 right-4 z-40">
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-elevated relative"
          onClick={() => setShowMobileCart(true)}
        >
          <ShoppingCart className="w-6 h-6" />
          {cartItemCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-6 w-6 p-0 flex items-center justify-center text-xs font-bold"
            >
              {cartItemCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Mobile Cart Total Bar — above bottom nav */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-36 left-4 right-4 z-30">
          <Button
            variant="accent"
            className="w-full h-12 rounded-xl shadow-elevated justify-between px-4"
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
        onCheckout={() => setShowPayment(true)}
        onHold={() => setShowHoldDialog(true)}
        onVoid={() => setShowVoidModal(true)}
      />

      {/* Modals */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        total={total}
        onConfirmPayment={handleConfirmPayment}
      />

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
          footerMessage={currentBranch?.receipt_footer_message || 'Thank you for your business!'}
        />
      )}

      <VoidSaleModal
        isOpen={showVoidModal}
        onClose={() => setShowVoidModal(false)}
        onConfirm={handleVoidSale}
        itemCount={cartItems.length}
        total={total}
      />

      <ReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onComplete={() => {}}
      />

      <ReprintReceiptModal
        isOpen={showReprintModal}
        onClose={() => setShowReprintModal(false)}
      />

      <HoldSaleDialog
        isOpen={showHoldDialog}
        onClose={() => setShowHoldDialog(false)}
        onConfirm={handleHoldSale}
        itemCount={cartItems.length}
        total={total}
      />

      <OpenShiftDialog
        isOpen={showOpenShift}
        onClose={() => setShowOpenShift(false)}
      />

      <CloseShiftDialog
        isOpen={showCloseShift}
        onClose={() => setShowCloseShift(false)}
      />

      <ZReport
        isOpen={showZReport}
        onClose={() => setShowZReport(false)}
      />

      {/* Bottom Navigation — Mobile */}
      <BottomNav />
    </div>
  );
};

export default Dashboard;
