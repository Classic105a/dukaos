// M-Pesa Daraja STK Push callback receiver.
// Public endpoint (no JWT) — Safaricom posts here.
// Stores raw payload, extracts metadata, attempts to reconcile with payments.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pickItem(items: any[] | undefined, name: string): any {
  if (!Array.isArray(items)) return undefined;
  return items.find((i) => i?.Name === name)?.Value;
}

function parseDarajaTimestamp(v: any): string | null {
  // Daraja TransactionDate is YYYYMMDDHHMMSS (number)
  if (v == null) return null;
  const s = String(v);
  if (s.length !== 14) return null;
  const iso = `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let raw: any;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const stk = raw?.Body?.stkCallback ?? raw?.stkCallback ?? raw;
    const checkoutRequestId = stk?.CheckoutRequestID ?? null;
    const merchantRequestId = stk?.MerchantRequestID ?? null;
    const resultCode = typeof stk?.ResultCode === "number" ? stk.ResultCode : null;
    const resultDesc = stk?.ResultDesc ?? null;
    const items = stk?.CallbackMetadata?.Item;

    const amount = pickItem(items, "Amount") ?? null;
    const receipt = pickItem(items, "MpesaReceiptNumber") ?? null;
    const phone = pickItem(items, "PhoneNumber") ?? null;
    const txDate = parseDarajaTimestamp(pickItem(items, "TransactionDate"));

    // Try to reconcile against an existing payment by checkout_request_id stored in mpesa_reference
    let saleId: string | null = null;
    let paymentId: string | null = null;
    let businessId: string | null = null;
    let branchId: string | null = null;

    if (checkoutRequestId) {
      const { data: payment } = await supabase
        .from("payments")
        .select("id, sale_id")
        .eq("mpesa_reference", checkoutRequestId)
        .maybeSingle();
      if (payment) {
        paymentId = payment.id;
        saleId = payment.sale_id;
        const { data: sale } = await supabase
          .from("sales")
          .select("business_id, branch_id")
          .eq("id", payment.sale_id)
          .maybeSingle();
        if (sale) {
          businessId = sale.business_id ?? null;
          branchId = sale.branch_id ?? null;
        }
      }
    }

    const { error } = await supabase.from("mpesa_callbacks").upsert({
      business_id: businessId,
      branch_id: branchId,
      sale_id: saleId,
      payment_id: paymentId,
      merchant_request_id: merchantRequestId,
      checkout_request_id: checkoutRequestId,
      result_code: resultCode,
      result_desc: resultDesc,
      amount,
      mpesa_receipt_number: receipt,
      phone_number: phone ? String(phone) : null,
      transaction_date: txDate,
      raw_payload: raw,
      reconciled: !!receipt && resultCode === 0 && !!paymentId,
      reconciled_at: receipt && resultCode === 0 && paymentId ? new Date().toISOString() : null,
    }, { onConflict: "checkout_request_id" });

    if (error) {
      console.error("[mpesa-callback] insert failed", error);
      return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "DB error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Daraja expects a 200 with this shape
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[mpesa-callback] error", e);
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});