import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { RefreshCw, Save, Trash2, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { MonthSelector } from "@/components/MonthSelector";

interface Movement {
  id: string;
  date: string;
  amount: number;
  description: string;
}

export default function MercadoPago() {
  const [tab, setTab] = useState<"movements" | "settings">("movements");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [fetching, setFetching] = useState(false);
  
  const [publicKey, setPublicKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
  
  const [movements, setMovements] = useState<Movement[]>([]);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const totalIn = movements.filter(m => m.amount > 0).reduce((sum, m) => sum + m.amount, 0);
  const totalOut = movements.filter(m => m.amount < 0).reduce((sum, m) => sum + Math.abs(m.amount), 0);
  const totalNet = totalIn - totalOut;

  useEffect(() => {
    checkCredentials();
  }, []);

  useEffect(() => {
    if (hasCredentials && tab === "movements") {
      fetchMovements();
    }
  }, [hasCredentials, tab, selectedMonth]);

  async function checkCredentials() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-check-credentials`,
        {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const result = await response.json();
      
      if (result.has_credentials && result.credentials) {
        setHasCredentials(true);
        setPublicKey(result.credentials.public_key);
        setAccessToken(result.credentials.access_token);
      } else {
        setTab("settings");
      }
    } catch (e) {
      setTab("settings");
    }
    setLoading(false);
  }

  async function saveCredentials() {
    if (!publicKey.trim() || !accessToken.trim()) {
      toast.error("Please enter both Public Key and Access Token");
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-save-credentials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ public_key: publicKey, access_token: accessToken }),
        }
      );

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      setHasCredentials(true);
      toast.success("Credentials saved successfully!");
      setTab("movements");
    } catch (error: any) {
      toast.error(error.message || "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  }

  async function fetchMovements() {
    setFetching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const monthParam = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-fetch-movements?month=${monthParam}`,
        {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const result = await response.json();
      console.log("Fetch movements response:", response.status, result);
      if (result.error) throw new Error(result.error);

      setMovements(result.movements || []);
      setLastFetched(result.fetched_at);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch movements");
    } finally {
      setFetching(false);
      setLoading(false);
    }
  }

  async function deleteCredentials() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase
      .from("mercado_pago_credentials")
      .delete()
      .eq("user_id", session.user.id);

    setHasCredentials(false);
    setPublicKey("");
    setAccessToken("");
    setMovements([]);
    setTab("settings");
    toast.success("Credentials deleted");
  }

  if (loading) {
    return (
      <AppLayout title="MercadoPago" subtitle="Loading...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="MercadoPago"
      subtitle="Manage your MercadoPago account"
    >
      <div className="mb-6 inline-flex rounded-full border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setTab("movements")}
          className={cn(
            "rounded-full px-4 py-1.5 text-[12.5px] transition-colors",
            tab === "movements"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Movements
        </button>
        <button
          type="button"
          onClick={() => setTab("settings")}
          className={cn(
            "rounded-full px-4 py-1.5 text-[12.5px] transition-colors",
            tab === "settings"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Settings
        </button>
      </div>

      {tab === "settings" && (
        <section className="rounded-md border border-border bg-surface p-5 max-w-xl">
          <div className="label-mono mb-4">API Credentials</div>
          <p className="text-[12px] text-muted-foreground mb-4">
            Enter your MercadoPago credentials from the Developer Panel.
          </p>
          <div className="space-y-4">
            <div>
              <div className="label-mono mb-2">Public Key</div>
              <Input
                placeholder="APP_USR-..."
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
              />
            </div>
            <div>
              <div className="label-mono mb-2">Access Token</div>
              <Input
                placeholder="APP_USR-..."
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveCredentials} disabled={saving} className="gap-1.5">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Credentials
              </Button>
              {hasCredentials && (
                <Button variant="ghost" onClick={deleteCredentials} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "movements" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {hasCredentials ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-[12px] text-muted-foreground">
                {hasCredentials ? "Connected" : "Not configured"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMovements}
                disabled={fetching || !hasCredentials}
                className="gap-1.5"
              >
                {fetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          {lastFetched && (
            <div className="text-[11px] text-muted-foreground mb-4">
              Last synced: {new Date(lastFetched).toLocaleString()}
            </div>
          )}

          {!fetching && movements.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-md border border-border bg-surface p-4">
                <div className="text-[11px] text-muted-foreground mb-1">In</div>
                <div className="text-[18px] font-semibold text-success">{formatMoney(totalIn)}</div>
              </div>
              <div className="rounded-md border border-border bg-surface p-4">
                <div className="text-[11px] text-muted-foreground mb-1">Out</div>
                <div className="text-[18px] font-semibold text-destructive">{formatMoney(totalOut)}</div>
              </div>
              <div className="rounded-md border border-border bg-surface p-4">
                <div className="text-[11px] text-muted-foreground mb-1">Net</div>
                <div className={cn("text-[18px] font-semibold", totalNet >= 0 ? "text-success" : "text-destructive")}>
                  {formatMoney(totalNet)}
                </div>
              </div>
            </div>
          )}

          {fetching && (
            <div className="flex items-center justify-center py-10 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-[13px] text-muted-foreground">Fetching movements from MercadoPago...</span>
            </div>
          )}

          {!fetching && movements.length === 0 && (
            <div className="text-center py-10 text-[12px] text-muted-foreground">
              No movements found for this month.
            </div>
          )}

          {!fetching && movements.length > 0 && (
            <div className="rounded-md border border-border bg-surface overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="label-mono border-b border-border">
                    <th className="px-4 py-3 text-left font-normal">Date</th>
                    <th className="px-4 py-3 text-left font-normal">Description</th>
                    <th className="px-4 py-3 text-right font-normal">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                        {m.date ? new Date(m.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] max-w-[200px] truncate">
                        {m.description}
                      </td>
                      <td className={cn("px-4 py-3 text-right text-[13px] font-medium num", m.amount >= 0 ? "text-success" : "text-destructive")}>
                        {formatMoney(m.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}