import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthSelector } from "@/components/MonthSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { startOfMonth, startOfMonthISO, formatMoney } from "@/lib/format";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Salary { id: string; month: string; amount: number; wallet_account_id: string | null }
interface Wallet { id: string; name: string; color: string }

export default function MySalary() {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState<string>("");
  const [history, setHistory] = useState<Salary[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  useEffect(() => { void load(); }, []);

  async function load() {
    const [s, w] = await Promise.all([
      supabase.from("salary").select("*").order("month", { ascending: false }),
      supabase.from("wallet_accounts").select("*").order("name"),
    ]);
    setHistory((s.data ?? []) as Salary[]);
    setWallets((w.data ?? []) as Wallet[]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount.");
    if (!walletId) return toast.error("Select a wallet.");
    const m = startOfMonthISO(month);
    const existing = history.find((h) => h.month === m);
    const payload = { amount: amt, wallet_account_id: walletId };
    const { error } = existing
      ? await supabase.from("salary").update(payload).eq("id", existing.id)
      : await supabase.from("salary").insert({ month: m, ...payload });
    if (error) return toast.error(error.message);
    toast.success("Salary recorded.");
    setAmount(""); setWalletId("");
    setOpen(false);
    void load();
  }

  async function del(id: string) {
    const { error } = await supabase.from("salary").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Salary entry deleted.");
    void load();
  }

  const walletName = (id: string | null) => wallets.find((w) => w.id === id)?.name ?? "—";
  const walletColor = (id: string | null) => wallets.find((w) => w.id === id)?.color ?? "transparent";

  return (
    <AppLayout
      title="Salary"
      subtitle="One entry per month."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
              Add Salary
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Add Salary</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div>
                <div className="label-mono mb-2">Month</div>
                <MonthSelector value={month} onChange={setMonth} />
              </div>
              <div>
                <div className="label-mono mb-2">Amount</div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                  <Input className="num pl-6 text-[15px]" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus />
                </div>
              </div>
              <div>
                <div className="label-mono mb-2">Wallet</div>
                <Select value={walletId} onValueChange={setWalletId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color }} />
                          {w.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <section className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <div className="label-mono">History</div>
        </div>
        {history.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-muted-foreground">No salary records yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="label-mono">
                <th className="px-5 py-3 text-left font-normal">Month</th>
                <th className="px-5 py-3 text-left font-normal">Wallet</th>
                <th className="px-5 py-3 text-right font-normal">Amount</th>
                <th className="w-[80px] px-5 py-3 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="group h-11 border-t border-border">
                  <td className="num px-5 text-[13px] whitespace-nowrap">
                    {new Date(h.month).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
                  </td>
                  <td className="px-5 text-[13px]">
                    <span className="inline-flex items-center gap-2 max-w-[150px] truncate">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: walletColor(h.wallet_account_id) }} />
                      {walletName(h.wallet_account_id)}
                    </span>
                  </td>
                  <td className="num px-5 text-right text-[13px]">{formatMoney(Number(h.amount))}</td>
                  <td className="px-5 text-right">
                    <button
                      onClick={() => del(h.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
