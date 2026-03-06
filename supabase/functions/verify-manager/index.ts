import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is authenticated
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { method, email, password, pin } = await req.json();

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (method === "pin") {
      if (!pin || pin.length !== 4) {
        return new Response(
          JSON.stringify({ error: "PIN must be 4 digits" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Use the security definer function to verify PIN without exposing data
      const { data, error } = await adminClient.rpc("verify_manager_pin", {
        p_pin: pin,
      });

      if (error || !data || data.length === 0) {
        return new Response(
          JSON.stringify({ error: "Invalid manager PIN" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const manager = data[0];
      return new Response(
        JSON.stringify({
          id: manager.user_id,
          email: manager.user_email,
          role: manager.user_role,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (method === "password") {
      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verify credentials server-side using admin API - does NOT touch caller's session
      const { data: signInData, error: signInError } =
        await adminClient.auth.signInWithPassword({ email, password });

      if (signInError || !signInData.user) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Sign the manager out of the admin client session immediately
      await adminClient.auth.admin.signOut(signInData.session?.access_token ?? '', 'local');

      // Check role
      const { data: roleData, error: roleError } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", signInData.user.id)
        .single();

      if (
        roleError ||
        !roleData ||
        !["owner", "admin", "manager"].includes(roleData.role)
      ) {
        return new Response(
          JSON.stringify({
            error: "Insufficient permissions. Manager or higher required.",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          id: signInData.user.id,
          email: email,
          role: roleData.role,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid method. Use 'pin' or 'password'" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Verification failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
