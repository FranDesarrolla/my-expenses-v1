import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // Create savings table
    await supabase.rpc('exec_sql', {
      sql: `CREATE TABLE IF NOT EXISTS savings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        goal_amount NUMERIC,
        color TEXT DEFAULT '#10b981',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    });

    // Create savings_deposits table  
    await supabase.rpc('exec_sql', {
      sql: `CREATE TABLE IF NOT EXISTS savings_deposits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        savings_id UUID REFERENCES savings(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        wallet_account_id UUID REFERENCES wallet_accounts(id),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
    });

    return new Response(
      JSON.stringify({ success: true, message: "Tables created" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});