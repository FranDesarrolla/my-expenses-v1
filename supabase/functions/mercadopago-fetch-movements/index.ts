import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_API_URL = "https://api.mercadopago.com";

async function downloadReport(accessToken: string, fileName: string): Promise<string> {
  const response = await fetch(
    `${MP_API_URL}/v1/account/settlement_report/${fileName}`,
    { headers: { "Authorization": `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to download report: ${response.status} - ${text}`);
  }

  return await response.text();
}

function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map((h: string) => h.trim().toUpperCase());
  const movements: any[] = [];

  const getIdx = (key: string) => headers.indexOf(key);

  const colSourceId = getIdx("SOURCE_ID");
  const colTransactionDate = getIdx("TRANSACTION_DATE");
  const colTransactionAmount = getIdx("TRANSACTION_AMOUNT");
  const colSettlementNetAmount = getIdx("SETTLEMENT_NET_AMOUNT");
  const colTransactionType = getIdx("TRANSACTION_TYPE");
  const colCurrency = getIdx("TRANSACTION_CURRENCY");
  const colExternalRef = getIdx("EXTERNAL_REFERENCE");

  const typesFound = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(";").map((v: string) => v.trim().replace(/^"|"$/g, ""));

    if (values.length < headers.length) continue;

    const transactionType = colTransactionType >= 0 ? values[colTransactionType] : "";
    typesFound.add(transactionType);

    const amount = colSettlementNetAmount >= 0
      ? parseFloat(values[colSettlementNetAmount])
      : (colTransactionAmount >= 0 ? parseFloat(values[colTransactionAmount]) : 0);

    if (isNaN(amount) || amount === 0) continue;

    const date = colTransactionDate >= 0 ? values[colTransactionDate] : "";
    const sourceId = colSourceId >= 0 ? values[colSourceId] : `mov-${i}`;
    const currency = colCurrency >= 0 ? values[colCurrency] : "ARS";
    const externalRef = colExternalRef >= 0 ? values[colExternalRef] : "";

    const desc = transactionType === "SETTLEMENT" 
      ? (externalRef || "Cobro")
      : transactionType === "WITHDRAWAL"
        ? "Transferencia/Retiro"
        : transactionType === "REFUND"
          ? "Devolución"
          : transactionType === "CHARGEBACK"
            ? "Chargeback"
            : transactionType || "Movimiento";

    movements.push({
      id: sourceId,
      date: date,
      amount: amount,
      currency: currency,
      description: desc,
      type: transactionType,
    });
  }

  return movements;
}

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
    const monthParam = url.searchParams.get("month");

    let year: number, month: number;
    if (monthParam) {
      [year, month] = monthParam.split("-").map(Number);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const listResponse = await fetch(
      `${MP_API_URL}/v1/account/settlement_report/list?limit=10`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );

    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    let reportData: { id?: number; report_id?: number; file_name?: string } | null = null;

    if (listResponse.ok) {
      const listData = await listResponse.json();
      const reports = listData.results || listData || [];

      for (const report of reports) {
        const beginDate = report.begin_date || "";
        if (beginDate.startsWith(monthStr)) {
          if (report.status === "ready" || report.status === "processed" || report.status === "finished") {
            reportData = report;
            break;
          }
        }
      }
    }

    let fileName: string | null = null;

    if (!reportData) {
      const createResponse = await fetch(
        `${MP_API_URL}/v1/account/settlement_report`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            begin_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            currency_id: "ARS",
          }),
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create report: ${createResponse.status} - ${errorText}`);
      }

      const createData = await createResponse.json();
      fileName = createData.file_name;
      reportData = createData;
    }

    if (!reportData || (!reportData.file_name && !fileName)) {
      throw new Error("No report data returned from API");
    }

    fileName = fileName || reportData.file_name || "";

    await new Promise((r) => setTimeout(r, 3000));

    const csvContent = await downloadReport(accessToken, fileName);
    const movements = parseCSV(csvContent);

    const typesFound = [...new Set(movements.map(m => m.type))];

    movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return new Response(
      JSON.stringify({
        success: true,
        movements: movements.slice(0, 100),
        file_name: fileName,
        types_found: typesFound,
        fetched_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});