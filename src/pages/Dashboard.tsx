import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBranch } from '@/hooks/useBranch';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProductGrid from '@/components/pos/ProductGrid';
import Cart, { CartItem } from '@/components/pos/Cart';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptModal from '@/components/pos/ReceiptModal';
import { toast } from 'sonner';

const Dashboard = () => {
  const { user } = useAuth();
  const { currentBranch } = useBranch();
  const { isOnline, saveSaleOffline } = useOfflineSync();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<{
    receiptNumber: string;
    payments: Array<{ method: string; amount: number; mpesa_reference?: string }>;
  } | null>(null);

  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const tax = 0;
  const discount = 0;
  const total = subtotal + tax - discount;

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

  const handleConfirmPayment = async (payments: Array<{ method: string; amount: number; mpesa_reference?: string; mpesa_phone?: string }>) => {
    if (!currentBranch?.id || !user?.id) {
      toast.error('Please select a branch');
      return;
    }

    const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}`;

    if (!isOnline) {
      saveSaleOffline({
        branch_id: currentBranch.id,
        items: cartItems.map(item => ({
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
        subtotal,
        tax_amount: tax,
        discount_amount: discount,
        total_amount: total,
        created_at: new Date().toISOString()
      });
      
      setLastSale({ receiptNumber, payments });
      setShowPayment(false);
      setShowReceipt(true);
      setCartItems([]);
      toast.success('Sale saved offline. Will sync when online.');
      return;
    }

    try {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          branch_id: currentBranch.id,
          cashier_id: user.id,
          receipt_number: receiptNumber,
          subtotal,
          tax_amount: tax,
          discount_amount: discount,
          total_amount: total,
          payment_status: 'completed'
        })
        .select()
        .single();

      if (saleError) throw saleError;

      await supabase.from('sale_items').insert(
        cartItems.map(item => ({
          sale_id: saleData.id,
          product_id: item.product_id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_amount: item.total
        }))
      );

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

      setLastSale({ receiptNumber, payments });
      setShowPayment(false);
      setShowReceipt(true);
      setCartItems([]);
      toast.success('Sale completed!');
    } catch (error) {
      console.error('Sale error:', error);
      toast.error('Failed to complete sale');
    }
  };

  return (
    <DashboardLayout>
      <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-8rem)]">
        <div className="lg:col-span-2 bg-card rounded-xl p-4 border border-border overflow-hidden">
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
          items={cartItems.length > 0 ? cartItems : []}
          subtotal={subtotal}
          tax={tax}
          discount={discount}
          total={total}
          payments={lastSale.payments}
          branchName={currentBranch?.name}
        />
      )}
    </DashboardLayout>
  );
};

export default Dashboard;
