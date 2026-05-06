import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarIcon, Trash2, Plus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";

interface ExtraIncome {
  id: string;
  concept: string;
  amount: number;
  date: string;
  notes: string | null;
  wallet_account_id: string | null;
}
interface Wallet { id: string; name: string; color: string }

export default function ExtraIncomePage() {
  const [items, setItems] = useState<ExtraIncome[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [open, setOpen] = useState(false);
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [walletId, setWalletId] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    const [inc, w] = await Promise.all([
      supabase.from("extra_income" as never).select("*").order("date", { ascending: false }),
      supabase.from("wallet_accounts").select("*").order("name"),
    ]);
    setItems((inc.data ?? []) as ExtraIncome[]);
    setWallets((w.data ?? []) as Wallet[]);
    if (w.data?.length && !walletId) setWalletId(w.data[0].id);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!concept.trim()) return toast.error("Concept required.");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount.");
    if (!walletId) return toast.error("Select a wallet.");
    const { error } = await supabase.from("extra_income" as never).insert({
      concept: concept.trim(),
      amount: amt,
      date,
      wallet_account_id: walletId,
      notes: notes.trim() || null,
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Income recorded.");
    setConcept(""); setAmount(""); setNotes("");
    setOpen(false);
    void load();
  }

  async function del(id: string) {
    const { error } = await supabase.from("extra_income" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Entry deleted.");
    void load();
  }

  const total = items.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <AppLayout
      title="Extra Income"
      subtitle="Non-salary earnings credited to a wallet."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="hidden md:inline">Add Income</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Add Extra Income</DialogTitle>
            </DialogHeader>
            <form onSubmit={add} className="space-y-4">
              <div>
                <div className="label-mono mb-2">Concept</div>
                <Input placeholder="e.g. Freelance project" value={concept} onChange={(e) => setConcept(e.target.value)} autoFocus />
              </div>
              <div>
                <div className="label-mono mb-2">Amount</div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                  <Input className="num pl-6" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="label-mono mb-2">Wallet</div>
                  <Select value={walletId} onValueChange={setWalletId}>
                    <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
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
                <div>
                  <div className="label-mono mb-2">Date</div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="num w-full justify-start text-[12px] font-normal">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />
                        {format(parseISO(date), "MMM dd, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={parseISO(date)} onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <div className="label-mono mb-2">Notes (optional)</div>
                <Textarea placeholder="Add context..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">Add Income</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <section className="rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="label-mono">History</div>
          <div className="num text-[13px] text-muted-foreground">
            Total: <span className="text-foreground">{formatMoney(total)}</span>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-muted-foreground">No extra income yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="label-mono">
                <th className="px-5 py-3 text-left font-normal">Date</th>
                <th className="px-5 py-3 text-left font-normal">Concept</th>
                <th className="px-5 py-3 text-left font-normal">Wallet</th>
                <th className="px-5 py-3 text-left font-normal">Notes</th>
                <th className="px-5 py-3 text-right font-normal">Amount</th>
                <th className="w-[80px] px-5 py-3 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const w = wallets.find((x) => x.id === i.wallet_account_id);
                return (
                  <tr key={i.id} className="group h-11 border-t border-border">
                    <td className="num px-5 text-[12.5px] text-muted-foreground whitespace-nowrap">
                      {new Date(i.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                    </td>
                    <td className="px-5 text-[13px] max-w-[120px] truncate">{i.concept}</td>
                    <td className="px-5 text-[12.5px]">
                      {w ? (
                        <span className="inline-flex items-center gap-2 max-w-[120px] truncate">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                          {w.name}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-5 text-[12.5px] text-muted-foreground">{i.notes ?? "—"}</td>
                    <td className="num px-5 text-right text-[13px] text-success">{formatMoney(Number(i.amount))}</td>
                    <td className="px-5 text-right">
                      <button
                        onClick={() => del(i.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
