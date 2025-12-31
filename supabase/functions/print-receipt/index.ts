import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { printerIp, printerPort, receiptData } = await req.json();

    if (!printerIp || !receiptData) {
      return new Response(
        JSON.stringify({ error: "Missing printerIp or receiptData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const port = printerPort || 9100;

    // Connect to the network printer via raw TCP socket
    const conn = await Deno.connect({
      hostname: printerIp,
      port: port,
      transport: "tcp",
    });

    // Convert base64 receipt data to bytes
    const bytes = Uint8Array.from(atob(receiptData), c => c.charCodeAt(0));
    
    // Send data to printer
    await conn.write(bytes);
    
    // Close connection
    conn.close();

    return new Response(
      JSON.stringify({ success: true, message: "Receipt sent to printer" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Print error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to print";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});