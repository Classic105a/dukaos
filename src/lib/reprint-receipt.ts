import { supabase } from '@/integrations/supabase/client';
import type { ReceiptData } from '@/lib/escpos';
import { format } from 'date-fns';

interface BranchLike {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  mpesa_till_number?: string | null;
  mpesa_paybill_number?: string | null;
  mpesa_account_number?: string | null;
  kra_pin?: string | null;
  receipt_footer_message?: string | null;
}

export interface ReprintPayload {
  receiptData: ReceiptData;
  receiptHtml: string;
}

/**
 * Load a completed sale + its items + payments and build a REPRINT-marked
 * receipt payload. Read-only: never mutates sales, inventory, or payments.
 */
export async function buildReprintPayload(
  saleId: string,
  branch: BranchLike | null | undefined
): Promise<ReprintPayload> {
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id, receipt_number, total_amount, subtotal, tax_amount, discount_amount, created_at')
    .eq('id', saleId)
    .maybeSingle();
  if (saleErr) throw saleErr;
  if (!sale) throw new Error('Sale not found');

  const [{ data: items, error: itemsErr }, { data: payments, error: payErr }] = await Promise.all([
    supabase
      .from('sale_items')
      .select('product_name, quantity, unit_price, total_amount')
      .eq('sale_id', saleId),
    supabase
      .from('payments')
      .select('payment_method, amount, mpesa_reference')
      .eq('sale_id', saleId),
  ]);
  if (itemsErr) throw itemsErr;
  if (payErr) throw payErr;

  const total = Number(sale.total_amount);
  const cashPay = (payments || []).find(p => p.payment_method === 'cash');
  const cashReceived = cashPay && Number(cashPay.amount) > total ? Number(cashPay.amount) : undefined;
  const changeGiven = cashReceived !== undefined ? cashReceived - total : undefined;

  const receiptData: ReceiptData = {
    header: {
      businessName: 'DukaOS',
      branchName: branch?.name || '',
      address: branch?.address || undefined,
      city: branch?.city || undefined,
      phone: branch?.phone || undefined,
      mpesaTill: branch?.mpesa_till_number || undefined,
      mpesaPaybill: branch?.mpesa_paybill_number || undefined,
      mpesaAccount: branch?.mpesa_account_number || undefined,
      kraPin: branch?.kra_pin || undefined,
    },
    receiptNumber: sale.receipt_number,
    date: new Date(sale.created_at),
    isReprint: true,
    items: (items || []).map(i => ({
      name: i.product_name,
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      totalPrice: Number(i.total_amount),
    })),
    subtotal: Number(sale.subtotal),
    taxAmount: Number(sale.tax_amount ?? 0),
    discountAmount: Number(sale.discount_amount ?? 0),
    totalAmount: total,
    payments: (payments || []).map(p => ({
      method: p.payment_method.toUpperCase(),
      amount: Number(p.amount),
      reference: p.mpesa_reference ?? undefined,
    })),
    cashReceived,
    changeGiven,
    footer: { message: branch?.receipt_footer_message || 'Thank you for your business!' },
  };

  const receiptHtml = `
    <div style="font-family: monospace; max-width: 300px; margin: 0 auto; font-size: 12px;">
      <div style="text-align: center; font-weight: bold; font-size: 16px; border: 2px dashed #000; padding: 6px; margin-bottom: 8px; letter-spacing: 2px;">
        *** REPRINT ***<br/>
        <span style="font-size: 11px; font-weight: normal; letter-spacing: 1px;">REPRINTED COPY — NOT AN ORIGINAL</span>
      </div>
      <div style="text-align: center; margin-bottom: 10px;">
        <strong>DukaOS</strong><br/>
        ${branch?.name || ''}<br/>
        ${branch?.address || ''}<br/>
        ${branch?.city || ''}<br/>
        ${branch?.phone ? `Tel: ${branch.phone}` : ''}
      </div>
      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
      <div>Receipt: ${sale.receipt_number}</div>
      <div>Date: ${format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm')}</div>
      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
      ${(items || []).map(item => `
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
      ${Number(sale.tax_amount ?? 0) > 0 ? `
        <div style="display: flex; justify-content: space-between;">
          <span>Tax:</span><span>KES ${Number(sale.tax_amount).toLocaleString()}</span>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; border-top: 1px dashed #000; padding-top: 4px;">
        <span>TOTAL:</span><span>KES ${total.toLocaleString()}</span>
      </div>
      <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
      ${(payments || []).map(p => `
        <div style="display: flex; justify-content: space-between;">
          <span>${p.payment_method.toUpperCase()}</span>
          <span>KES ${Number(p.amount).toLocaleString()}</span>
        </div>
      `).join('')}
      <div style="text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 8px;">
        ${branch?.receipt_footer_message || 'Thank you for your business!'}
      </div>
    </div>
  `;

  return { receiptData, receiptHtml };
}