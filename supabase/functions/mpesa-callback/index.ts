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

  // Shared-secret check: Safaricom Daraja lets you configure the callback URL
  // with a query parameter or custom header. We require one to match
  // MPESA_CALLBACK_SECRET so the public endpoint cannot be forged.
  const expectedSecret = Deno.env.get("MPESA_CALLBACK_SECRET");
  if (expectedSecret) {
    const url = new URL(req.url);
    const providedSecret =
      url.searchParams.get("secret") ??
      req.headers.get("x-callback-secret") ??
      req.headers.get("X-Callback-Secret");
    if (providedSecret !== expectedSecret) {
      console.warn("[mpesa-callback] rejected: bad/missing shared secret");
      return new Response(
        JSON.stringify({ ResultCode: 1, ResultDesc: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } else {
    console.warn(
      "[mpesa-callback] MPESA_CALLBACK_SECRET not configured — callback is unauthenticated. " +
        "Set this secret and append ?secret=<value> to the Daraja callback URL.",
    );
  }

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

    // Idempotency: a callback we already reconciled is acknowledged without any further
    // processing (Safaricom retries, duplicate deliveries, delayed re-sends).
    if (checkoutRequestId) {
      const { data: existing } = await supabase
        .from("mpesa_callbacks")
        .select("id, reconciled")
        .eq("checkout_request_id", checkoutRequestId)
        .maybeSingle();
      if (existing?.reconciled) {
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted (duplicate)" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Reconcile against an existing completed payment. The POS stores either the
    // CheckoutRequestID (STK flows) or the customer's M-Pesa receipt code (till/paybill
    // flows) in payments.mpesa_reference. This function only LINKS records; it never
    // creates sales/payments or touches stock, so replays are side-effect free.
    let saleId: string | null = null;
    let paymentId: string | null = null;
    let businessId: string | null = null;
    let branchId: string | null = null;

    const candidates = [checkoutRequestId, receipt ? String(receipt).toUpperCase() : null].filter(Boolean) as string[];
    if (candidates.length > 0) {
      const { data: payment } = await supabase
        .from("payments")
        .select("id, sale_id")
        .eq("payment_method", "mpesa")
        .eq("status", "completed")
        .in("mpesa_reference", candidates)
        .limit(1)
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

    const reconciled = !!receipt && resultCode === 0 && !!paymentId;
    const row = {
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
      reconciled,
      reconciled_at: reconciled ? new Date().toISOString() : null,
    };

    // Unique indexes on checkout_request_id and mpesa_receipt_number make this upsert
    // the single point of idempotency for the callback record.
    const { error } = checkoutRequestId
      ? await supabase.from("mpesa_callbacks").upsert(row, { onConflict: "checkout_request_id" })
      : await supabase.from("mpesa_callbacks").insert(row);

    if (error && (error as any).code === "23505") {
      // Same receipt already stored via another delivery — treat as idempotent success.
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted (duplicate)" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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