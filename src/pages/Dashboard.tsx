import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePrinter } from '@/hooks/usePrinter';
import { useTaxSettings } from '@/hooks/useTaxSettings';
import { useHoldSale } from '@/hooks/useHoldSale';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProductGrid from '@/components/pos/ProductGrid';
import Cart, { CartItem } from '@/components/pos/Cart';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptModal from '@/components/pos/ReceiptModal';
import VoidSaleModal from '@/components/pos/VoidSaleModal';
import ReturnModal from '@/components/pos/ReturnModal';
import ReprintReceiptModal from '@/components/pos/ReprintReceiptModal';
import HeldSalesPanel from '@/components/pos/HeldSalesPanel';
import HoldSaleDialog from '@/components/pos/HoldSaleDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { ReceiptData } from '@/lib/escpos';
import { RotateCcw, Printer, XCircle, PauseCircle } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const { isOnline, saveSaleOffline } = useOfflineSync();
  const { printReceipt, hasPrinter, isPrinting } = usePrinter();
  const { calculateTax } = useTaxSettings();
  const { heldSales, holdSale, resumeSale, deleteHeldSale } = useHoldSale();
  const lastSaleItemsRef = useRef<CartItem[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [lastSaleTotal, setLastSaleTotal] = useState({ subtotal: 0, tax: 0, discount: 0, total: 0 });
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [showHoldDialog, setShowHoldDialog] = useState(false);
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
      
      // Prevent adding if no stock available
      if (availableStock <= 0) {
        toast.error('Out of stock');
        return prev;
      }
      
      // Prevent exceeding available stock
      if (currentQtyInCart >= availableStock) {
        toast.error(`Only ${availableStock} available in stock`);
        return prev;
      }
      
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price }
            : item
        );
      }
      return [...prev, {
        id: `cart_${Date.now()}`,
        product_id: product.id,
        name: product.name,
        unit_price: product.unit_price,
        quantity: 1,
        total: product.unit_price
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

  // Auto-print receipt function
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

  const handleConfirmPayment = async (payments: Array<{ method: string; amount: number; mpesa_reference?: string; mpesa_phone?: string }>) => {
    if (!currentBranch?.id || !user?.id) {
      toast.error('Please select a branch');
      return;
    }

    const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}`;
    
    // Store cart items and totals before clearing
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
      setShowReceipt(true);
      setCartItems([]);
      toast.success('Sale saved offline. Will sync when online.');
      
      // Auto-print receipt
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
          payment_status: 'completed'
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

      // Deduct stock for each item
      for (const item of saleItems) {
        const { data: inventory } = await supabase
          .from('branch_inventory')
          .select('id, quantity')
          .eq('branch_id', currentBranch.id)
          .eq('product_id', item.product_id)
          .maybeSingle();

        if (inventory) {
          await supabase
            .from('branch_inventory')
            .update({ quantity: Math.max(0, inventory.quantity - item.quantity) })
            .eq('id', inventory.id);
        }
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
      setShowReceipt(true);
      setCartItems([]);
      toast.success('Sale completed!');
      
      // Auto-print receipt
      autoPrintReceipt(receiptNumber, saleItems, saleSubtotal, saleTax, saleDiscount, saleTotal, payments);
    } catch (error) {
      console.error('Sale error:', error);
      toast.error('Failed to complete sale');
    }
  };

  const handleVoidSale = (reason: string) => {
    console.log('Sale voided:', { items: cartItems, reason });
    toast.success('Sale voided');
    setCartItems([]);
  };

  const handleHoldSale = (customerName?: string) => {
    if (cartItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    holdSale(cartItems, subtotal, tax, discount, total, customerName);
    setCartItems([]);
    toast.success('Sale held successfully');
  };

  const handleResumeSale = (saleId: string) => {
    // If current cart has items, offer to hold them first
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

  return (
    <DashboardLayout>
      <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-8rem)]">
        <div className="lg:col-span-2 bg-card rounded-xl p-4 border border-border overflow-hidden">
          {/* Quick Action Buttons */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <HeldSalesPanel
              heldSales={heldSales}
              onResume={handleResumeSale}
              onDelete={handleDeleteHeldSale}
              triggerButton={
                <Button variant="outline" size="sm" className="relative">
                  <PauseCircle className="w-4 h-4 mr-1" />
                  Held
                  {heldSales.length > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {heldSales.length}
                    </Badge>
                  )}
                </Button>
              }
            />
            {cartItems.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowHoldDialog(true)}>
                <PauseCircle className="w-4 h-4 mr-1" />
                Hold Sale
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowReturnModal(true)}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Returns
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowReprintModal(true)}>
              <Printer className="w-4 h-4 mr-1" />
              Reprint
            </Button>
            {cartItems.length > 0 && (
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setShowVoidModal(true)}>
                <XCircle className="w-4 h-4 mr-1" />
                Void
              </Button>
            )}
          </div>
          <ProductGrid onProductSelect={handleProductSelect} />
        </div>
        <div className="bg-card rounded-xl p-4 border border-border flex flex-col">
          <h2 className="font-bold text-lg mb-4">Current Sale</h2>
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
    </DashboardLayout>
  );
};

export default Dashboard;
