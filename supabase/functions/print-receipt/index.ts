import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation helpers
const isValidIPv4 = (ip: string): boolean => {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
};

const isPrivateIP = (ip: string): boolean => {
  const parts = ip.split('.').map(Number);
  // 10.x.x.x, 172.16-31.x.x, 192.168.x.x
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
};

const isValidPort = (port: number): boolean => {
  // Only allow common printer ports
  const allowedPorts = [9100, 515, 631, 9101, 9102];
  return allowedPorts.includes(port);
};

const MAX_RECEIPT_DATA_SIZE = 50000; // 50KB max for receipt data

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract and validate authorization
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client to verify auth and check permissions
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const { printerIp, printerPort, receiptData } = body;

    // Validate required fields
    if (!printerIp || !receiptData) {
      return new Response(
        JSON.stringify({ error: "Missing printerIp or receiptData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate IP address format
    if (typeof printerIp !== 'string' || !isValidIPv4(printerIp)) {
      return new Response(
        JSON.stringify({ error: "Invalid printer IP address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow private network IPs to prevent SSRF
    if (!isPrivateIP(printerIp)) {
      return new Response(
        JSON.stringify({ error: "Printer IP must be on a private network" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate port
    const port = typeof printerPort === 'number' ? printerPort : 9100;
    if (!isValidPort(port)) {
      return new Response(
        JSON.stringify({ error: "Invalid printer port. Allowed ports: 9100, 515, 631, 9101, 9102" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate receipt data
    if (typeof receiptData !== 'string') {
      return new Response(
        JSON.stringify({ error: "Receipt data must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (receiptData.length > MAX_RECEIPT_DATA_SIZE) {
      return new Response(
        JSON.stringify({ error: "Receipt data exceeds maximum size" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate base64 format
    try {
      atob(receiptData);
    } catch {
      return new Response(
        JSON.stringify({ error: "Receipt data must be valid base64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the printer IP is registered in the database for user's branch
    const { data: printerConfig, error: printerError } = await supabase
      .from('printer_configurations')
      .select('id, branch_id, ip_address')
      .eq('ip_address', printerIp)
      .eq('connection_type', 'ethernet')
      .eq('is_active', true)
      .maybeSingle();

    if (printerError) {
      console.error("Printer lookup error:", printerError);
      return new Response(
        JSON.stringify({ error: "Failed to verify printer configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!printerConfig) {
      return new Response(
        JSON.stringify({ error: "Printer not registered. Please configure the printer in settings first." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to this branch
    const { data: branchAccess, error: branchError } = await supabase
      .from('branch_users')
      .select('id')
      .eq('branch_id', printerConfig.branch_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (branchError) {
      console.error("Branch access lookup error:", branchError);
      return new Response(
        JSON.stringify({ error: "Failed to verify branch access" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!branchAccess) {
      return new Response(
        JSON.stringify({ error: "You don't have access to this printer's branch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Connect to the network printer via raw TCP socket with timeout
    const conn = await Promise.race([
      Deno.connect({
        hostname: printerIp,
        port: port,
        transport: "tcp",
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Connection timeout")), 10000)
      )
    ]);

    // Convert base64 receipt data to bytes
    const bytes = Uint8Array.from(atob(receiptData), c => c.charCodeAt(0));
    
    // Send data to printer
    await conn.write(bytes);
    
    // Close connection
    conn.close();

    console.log(`Print job sent to ${printerIp}:${port} by user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, message: "Receipt sent to printer" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Print error:", error);
    // Return a graceful 200 with a fallback flag so the client can degrade to
    // browser print instead of surfacing a fatal 500 (edge functions cannot
    // reach LAN-only printer IPs, so timeouts are expected here).
    const isTimeout = error instanceof Error && error.message === "Connection timeout";
    return new Response(
      JSON.stringify({
        success: false,
        fallback: true,
        error: isTimeout ? "Printer unreachable from cloud (LAN-only)" : "Failed to print receipt",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
