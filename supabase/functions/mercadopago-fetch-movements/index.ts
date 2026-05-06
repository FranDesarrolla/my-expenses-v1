import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API_URL = "https://api.mercadopago.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid token");

    const { data: credentials, error: credError } = await supabase
      .from("mercado_pago_credentials").select("access_token").eq("user_id", user.id).single();
    if (credError || !credentials) throw new Error("No credentials found");

    const accessToken = credentials.access_token;
    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    
    let endDate = new Date();
    let startDate = new Date();
    
    if (month) {
      const [year, monthNum] = month.split("-").map(Number);
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 1);
      endDate.setDate(endDate.getDate() - 1);
    } else {
      const days = parseInt(url.searchParams.get("days") || "30");
      startDate.setDate(startDate.getDate() - days);
    }
    
    const formatDate = (d: Date) => d.toISOString().split("T")[0];
    const movements: any[] = [];

    const response = await fetch(
      `${MP_API_URL}/v1/payments/search?sort=date_created&criteria=desc&limit=500&range=date_created&begin_date=${formatDate(startDate)}T00:00:00Z&end_date=${formatDate(endDate)}T23:59:59Z`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );

    if (response.ok) {
      const data = await response.json();
      const payments = Array.isArray(data) ? data : data.results || [];
      
      for (const p of payments) {
        const amount = parseFloat(p.transaction_amount || p.net_received_amount || 0);
        if (!amount) continue;
        
        movements.push({
          id: p.id,
          date: p.date_created,
          amount: amount,
          description: p.description || p.payment_method_id || "Movimiento",
        });
      }
    }

    movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return new Response(
      JSON.stringify({
        success: true,
        movements: movements.slice(0, 100),
        fetched_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});