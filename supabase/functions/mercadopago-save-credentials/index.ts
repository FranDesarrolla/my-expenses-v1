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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Invalid token");
    }

    const { public_key, access_token } = await req.json();

    if (!public_key || !access_token) {
      throw new Error("Missing public_key or access_token");
    }

    // Check if credentials already exist for this user
    const { data: existing } = await supabase
      .from("mercado_pago_credentials")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from("mercado_pago_credentials")
        .update({
          public_key: public_key,
          access_token: access_token,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from("mercado_pago_credentials")
        .insert({
          user_id: user.id,
          public_key: public_key,
          access_token: access_token,
          country: "AR",
        });

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "Credentials saved successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});