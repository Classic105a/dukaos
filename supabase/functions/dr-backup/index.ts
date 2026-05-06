// DR backup edge function — exports business data as JSON, uploads to dr-backups bucket,
// records backup_runs, and prunes files older than 30 days.
//
// Modes:
//   POST { mode: "on_demand", business_id }  — manual export, requires authenticated owner/admin
//   POST { mode: "scheduled" }                — invoked by pg_cron, iterates all active businesses
//                                                (caller must present service role key OR the
//                                                 anon key when called from cron with header)
//
// Returns: { ok, runs: [...], download_url? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

// Tables to back up. Each is filtered by business_id when that column exists.
const TABLES_WITH_BUSINESS: string[] = [
  "businesses",
  "business_users",
  "branches",
  "branch_users",
  "products",
  "categories",
  "customers",
  "parties",
  "sales",
  "sale_items",
  "payments",
  "returns",
  "current_stock",
  "branch_inventory",
  "stock_movements",
  "promotions",
  "promo_redemptions",
  "credit_transactions",
  "installment_plans",
  "payable_transactions",
  "purchase_orders",
  "purchase_order_items",
  "goods_received_notes",
  "grn_items",
  "reorder_rules",
  "cashier_shifts",
  "legal_cases",
  "audit_logs",
  "receipt_settings",
  "receipt_sequences",
  "printer_configurations",
  "custom_permissions",
  "approval_requests",
  "error_logs",
  "perf_metrics",
  "backup_runs",
];

const RETENTION_DAYS = 30;

async function fetchAll(
  admin: ReturnType<typeof createClient>,
  table: string,
  businessId: string | null
): Promise<any[]> {
  const PAGE = 1000;
  let from = 0;
  const out: any[] = [];
  // Try with business filter; if column doesn't exist, retry without.
  while (true) {
    let q = admin.from(table).select("*").range(from, from + PAGE - 1);
    if (businessId) q = q.eq("business_id", businessId);
    let { data, error } = await q;
    if (error && businessId && /column .* does not exist/i.test(error.message)) {
      const retry = await admin.from(table).select("*").range(from, from + PAGE - 1);
      data = retry.data ?? [];
      error = retry.error ?? null;
    }
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function backupBusiness(
  admin: ReturnType<typeof createClient>,
  businessId: string,
  kind: "on_demand" | "scheduled",
  triggeredBy: string | null
): Promise<{ run_id: string; file_path: string; size_bytes: number; rows: number; tables: number }> {
  const { data: runRow, error: runErr } = await admin
    .from("backup_runs")
    .insert({ business_id: businessId, kind, status: "running", triggered_by: triggeredBy })
    .select("id")
    .single();
  if (runErr) throw runErr;
  const runId = runRow.id as string;

  try {
    const snapshot: Record<string, any[]> = {};
    let totalRows = 0;
    for (const t of TABLES_WITH_BUSINESS) {
      try {
        const rows = await fetchAll(admin, t, businessId);
        snapshot[t] = rows;
        totalRows += rows.length;
      } catch (e) {
        console.warn(`[dr-backup] skipping ${t}: ${(e as Error).message}`);
        snapshot[t] = [];
      }
    }

    const payload = {
      meta: {
        business_id: businessId,
        generated_at: new Date().toISOString(),
        kind,
        version: 1,
      },
      data: snapshot,
    };

    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);

    const dt = new Date();
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    const hh = String(dt.getUTCHours()).padStart(2, "0");
    const mi = String(dt.getUTCMinutes()).padStart(2, "0");
    const filePath = `${businessId}/${yyyy}/${mm}/${dd}/backup-${yyyy}${mm}${dd}T${hh}${mi}-${runId.slice(0, 8)}.json`;

    const up = await admin.storage.from("dr-backups").upload(filePath, bytes, {
      contentType: "application/json",
      upsert: false,
    });
    if (up.error) throw up.error;

    await admin
      .from("backup_runs")
      .update({
        status: "success",
        file_path: filePath,
        size_bytes: bytes.byteLength,
        tables_count: Object.keys(snapshot).length,
        rows_count: totalRows,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return {
      run_id: runId,
      file_path: filePath,
      size_bytes: bytes.byteLength,
      rows: totalRows,
      tables: Object.keys(snapshot).length,
    };
  } catch (e) {
    await admin
      .from("backup_runs")
      .update({
        status: "failed",
        error: (e as Error).message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    throw e;
  }
}

async function pruneOld(admin: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000);
  const { data: oldRuns } = await admin
    .from("backup_runs")
    .select("id, file_path")
    .lt("started_at", cutoff.toISOString())
    .not("file_path", "is", null);
  if (oldRuns && oldRuns.length > 0) {
    const paths = oldRuns.map((r: any) => r.file_path).filter(Boolean);
    if (paths.length) await admin.storage.from("dr-backups").remove(paths);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mode: "on_demand" | "scheduled" = body.mode === "scheduled" ? "scheduled" : "on_demand";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    if (mode === "scheduled") {
      // Pruning + per-business backup. Require shared secret OR service-role JWT.
      const incomingSecret = req.headers.get("x-cron-secret") ?? "";
      const authHeader = req.headers.get("Authorization") ?? "";
      const presentedKey = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : "";
      const secretOk = CRON_SECRET.length > 0 && incomingSecret === CRON_SECRET;
      const serviceOk = presentedKey.length > 0 && presentedKey === SERVICE_ROLE;
      if (!secretOk && !serviceOk) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await pruneOld(admin);
      const { data: bizs, error } = await admin
        .from("businesses")
        .select("id")
        .eq("is_active", true);
      if (error) throw error;
      const runs: any[] = [];
      for (const b of bizs ?? []) {
        try {
          runs.push(await backupBusiness(admin, b.id, "scheduled", null));
        } catch (e) {
          runs.push({ business_id: b.id, error: (e as Error).message });
        }
      }
      return new Response(JSON.stringify({ ok: true, runs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // On-demand: require authenticated owner/admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: uerr } = await userClient.auth.getUser();
    if (uerr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const businessId = body.business_id as string | undefined;
    if (!businessId) {
      return new Response(JSON.stringify({ error: "business_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is owner of this business via business_users
    const { data: membership } = await admin
      .from("business_users")
      .select("is_owner, role")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership || (!membership.is_owner && membership.role !== "admin")) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await pruneOld(admin);
    const result = await backupBusiness(admin, businessId, "on_demand", userId);

    // Signed URL valid for 1 hour for immediate download
    const signed = await admin.storage
      .from("dr-backups")
      .createSignedUrl(result.file_path, 3600);

    return new Response(
      JSON.stringify({ ok: true, run: result, download_url: signed.data?.signedUrl ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[dr-backup] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});