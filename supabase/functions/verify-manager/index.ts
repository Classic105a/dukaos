// Manager override verification.
// Verifies a manager's PIN or password server-side (never touching the caller's
// session), scoped to the caller's business, and issues a short-lived, single-use
// approval record that privileged RPCs (e.g. process_return) consume.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MANAGER_ROLES = ["owner", "admin", "manager"];
const REQUEST_TYPES = ["REFUND", "VOID", "DISCOUNT", "PRICE_OVERRIDE", "CREDIT_SALE"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Invalid session" }, 401);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const { method, email, password, pin, business_id, branch_id, request_type, entity_id, reason } = body ?? {};

    if (typeof business_id !== "string" || !/^[0-9a-f-]{36}$/i.test(business_id)) {
      return json({ error: "business_id is required" }, 400);
    }
    if (branch_id != null && !/^[0-9a-f-]{36}$/i.test(String(branch_id))) {
      return json({ error: "Invalid branch_id" }, 400);
    }
    if (entity_id != null && !/^[0-9a-f-]{36}$/i.test(String(entity_id))) {
      return json({ error: "Invalid entity_id" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Caller must be an active member of the business they are requesting approval in.
    const { data: membership } = await adminClient
      .from("business_users")
      .select("id")
      .eq("business_id", business_id)
      .eq("user_id", caller.id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) return json({ error: "Not a member of this business" }, 403);

    let manager: { id: string; email: string; role: string } | null = null;

    if (method === "pin") {
      if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
        return json({ error: "PIN must be 4 digits" }, 400);
      }
      const { data, error } = await adminClient.rpc("verify_manager_pin", {
        p_pin: pin,
        p_business_id: business_id,
      });
      if (error || !data || data.length === 0) {
        console.warn("[verify-manager] PIN rejected", { caller: caller.id, business_id });
        return json({ error: "Invalid manager PIN" }, 403);
      }
      const { data: prof } = await adminClient
        .from("profiles")
        .select("email")
        .eq("id", data[0].user_id)
        .maybeSingle();
      manager = { id: data[0].user_id, email: prof?.email ?? "", role: data[0].role };
    } else if (method === "password") {
      if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
        return json({ error: "Email and password required" }, 400);
      }
      // Verify credentials with an isolated client so the caller's session is untouched.
      const verifier = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: signInData, error: signInError } = await verifier.auth.signInWithPassword({ email, password });
      if (signInError || !signInData.user) return json({ error: "Invalid credentials" }, 403);
      await verifier.auth.signOut({ scope: "local" }).catch(() => {});

      const { data: roleRow } = await adminClient
        .from("business_users")
        .select("role")
        .eq("business_id", business_id)
        .eq("user_id", signInData.user.id)
        .eq("status", "active")
        .in("role", MANAGER_ROLES)
        .maybeSingle();
      if (!roleRow) {
        return json({ error: "Insufficient permissions. Manager or higher in this business required." }, 403);
      }
      manager = { id: signInData.user.id, email, role: roleRow.role };
    } else {
      return json({ error: "Invalid method" }, 400);
    }

    // Issue a single-use approval record consumed by server-side RPCs.
    let approvalId: string | null = null;
    if (typeof request_type === "string" && REQUEST_TYPES.includes(request_type)) {
      const { data: approval, error: approvalError } = await adminClient
        .from("approval_requests")
        .insert({
          request_type,
          requested_by: caller.id,
          approved_by: manager.id,
          branch_id: branch_id ?? null,
          entity_type: request_type.toLowerCase(),
          entity_id: entity_id ?? null,
          status: "approved",
          reason: typeof reason === "string" ? reason.slice(0, 500) : null,
          resolved_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (approvalError) {
        console.error("[verify-manager] approval insert failed", approvalError);
        return json({ error: "Could not record approval" }, 500);
      }
      approvalId = approval.id;
    }

    await adminClient.from("audit_logs").insert({
      user_id: caller.id,
      action: "MANAGER_OVERRIDE_VERIFIED",
      entity_type: "approval",
      entity_id: approvalId,
      branch_id: branch_id ?? null,
      business_id,
      new_values: { method, approved_by: manager.id, request_type: request_type ?? null, entity_id: entity_id ?? null },
    });

    return json({ id: manager.id, email: manager.email, role: manager.role, approval_id: approvalId });
  } catch (error) {
    console.error("[verify-manager] error", error);
    return json({ error: "Internal server error" }, 500);
  }
});
