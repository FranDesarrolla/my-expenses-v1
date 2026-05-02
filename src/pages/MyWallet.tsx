import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { ArrowRight, CalendarIcon, Trash2, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";

interface Wallet { id: string; name: string; color: string }
interface Distribution { id: string; wallet_account_id: string; month: string; amount: number }
interface SalaryRow { wallet_account_id: string | null; amount: number }
interface ExtraIncomeRow { wallet_account_id: string | null; amount: number }
interface ExpenseRow { wallet_account_id: string | null; amount: number; id?: string }
interface FixedRow { id: string; wallet_account_id: string | null; amount: number }
interface FixedPayment { fixed_expense_id: string; month: string; paid: boolean; amount?: number }
interface ExpensePayment { expense_id: string; paid: boolean }
interface Transfer {
  id: string;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  amount: number;
  date: string;
  notes: string | null;
}

interface CardPayment {
  id: string;
  wallet_account_id: string | null;
  amount: number;
  month: string;
}

export default function MyWallet() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [transferOpen, setTransferOpen] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncomeRow[]>([]);
  const [allDistributions, setAllDistributions] = useState<Distribution[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedRow[]>([]);
  const [fixedPayments, setFixedPayments] = useState<FixedPayment[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPayment[]>([]);

  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  useEffect(() => { void load(); }, [month]);

  async function load() {
    const [w, sal, ei, all, e, fe, fp, tr, cp, expPays] = await Promise.all([
      supabase.from("wallet_accounts").select("*").order("name"),
      supabase.from("salary").select("wallet_account_id, amount"),
      supabase.from("extra_income" as never).select("wallet_account_id, amount"),
      supabase.from("wallet_distributions").select("*"),
      supabase.from("expenses").select("id, wallet_account_id, amount"),
      supabase.from("fixed_expenses").select("id, wallet_account_id, amount").lte("start_date", format(endOfMonth(month), "yyyy-MM-dd")).or("end_date.is.null,end_date.gte." + format(startOfMonth(month), "yyyy-MM-dd")),
      supabase.from("fixed_expense_payments").select("fixed_expense_id, month, paid"),
      supabase.from("wallet_transfers").select("*").order("date", { ascending: false }),
      (supabase.from("card_payments" as any).select("wallet_account_id, amount, month") as any),
      (supabase.from("expense_payments" as any).select("expense_id, paid") as any),
    ]);
    setWallets((w.data ?? []) as Wallet[]);
    setSalaries((sal.data ?? []) as SalaryRow[]);
    setExtraIncomes((ei.data ?? []) as ExtraIncomeRow[]);
    setAllDistributions((all.data ?? []) as Distribution[]);
    setExpenses((e.data ?? []) as ExpenseRow[]);
    setExpensePayments((expPays.data ?? []) as ExpensePayment[]);
    setFixedExpenses((fe.data ?? []) as FixedRow[]);
    setFixedPayments((fp.data ?? []) as FixedPayment[]);
    setTransfers((tr.data ?? []) as Transfer[]);
    setCardPayments((cp.data ?? []) as CardPayment[]);
  }

  const balances = useMemo(() => {
    return wallets.map((w) => {
      const fromSalary = salaries.filter((s) => s.wallet_account_id === w.id).reduce((s, x) => s + Number(x.amount), 0);
      const fromExtra = extraIncomes.filter((s) => s.wallet_account_id === w.id).reduce((s, x) => s + Number(x.amount), 0);
      const fromDistributions = allDistributions.filter((d) => d.wallet_account_id === w.id).reduce((s, d) => s + Number(d.amount), 0);
      const transfersIn = transfers.filter((t) => t.to_wallet_id === w.id).reduce((s, t) => s + Number(t.amount), 0);
      const transfersOut = transfers.filter((t) => t.from_wallet_id === w.id).reduce((s, t) => s + Number(t.amount), 0);
      const credited = fromSalary + fromExtra + fromDistributions + transfersIn - transfersOut;

      const spentOneOff = expenses
        .filter((x) => {
          const isPaid = expensePayments.find((p) => p.expense_id === x.id && p.paid)?.paid ?? false;
          return x.wallet_account_id === w.id && isPaid;
        })
        .reduce((s, x) => s + Number(x.amount), 0);
      const spentFixed = fixedExpenses
        .filter((f) => f.wallet_account_id === w.id)
        .reduce((s, f) => {
          const paidMonths = fixedPayments.filter((p) => p.fixed_expense_id === f.id && p.paid);
          const total = paidMonths.reduce((sum, p) => sum + (p.amount ?? Number(f.amount)), 0);
          return s + total;
        }, 0);
      const spentCardPayments = cardPayments
        .filter((cp) => cp.wallet_account_id === w.id)
        .reduce((s, cp) => s + Number(cp.amount), 0);
      const spent = spentOneOff + spentFixed + spentCardPayments;
      return { wallet: w, credited, spent, balance: credited - spent };
    });
  }, [wallets, salaries, extraIncomes, allDistributions, transfers, expenses, fixedExpenses, fixedPayments, cardPayments, expensePayments]);

  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

  async function saveTransfer(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount.");
    if (!fromId || !toId) return toast.error("Select both wallets.");
    if (fromId === toId) return toast.error("Source and destination must differ.");
    const { error } = await supabase.from("wallet_transfers").insert({
      from_wallet_id: fromId,
      to_wallet_id: toId,
      amount: amt,
      date,
      notes: notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Transfer recorded.");
    setAmount(""); setNotes(""); setFromId(""); setToId("");
    setTransferOpen(false);
    void load();
  }

  async function delTransfer(id: string) {
    const { error } = await supabase.from("wallet_transfers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Transfer deleted.");
    void load();
  }

  const walletName = (id: string | null) => wallets.find((w) => w.id === id)?.name ?? "—";
  const walletColor = (id: string | null) => wallets.find((w) => w.id === id)?.color ?? "transparent";

  return (
    <AppLayout
      title="My Wallet"
      subtitle="Track balances and transfers between accounts."
      actions={
        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
              Transfer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>New Transfer</DialogTitle>
            </DialogHeader>
            <form onSubmit={saveTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="label-mono mb-2">From</div>
                  <Select value={fromId} onValueChange={setFromId}>
                    <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
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
                  <div className="label-mono mb-2">To</div>
                  <Select value={toId} onValueChange={setToId}>
                    <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="label-mono mb-2">Amount</div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                    <Input className="num pl-6" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
                  </div>
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
                      <Calendar mode="single" selected={parseISO(date)} onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <div className="label-mono mb-2">Notes (optional)</div>
                <Textarea placeholder="Transfer notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setTransferOpen(false)}>Cancel</Button>
                <Button type="submit">Transfer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {balances.length === 0 ? (
              <div className="md:col-span-3 rounded-md border border-border bg-surface p-8 text-center text-[12px] text-muted-foreground">
                No wallet accounts yet. Add some in Tables.
              </div>
            ) : balances.map(({ wallet, credited, spent, balance }) => (
              <div key={wallet.id} className="rounded-md border border-border bg-surface p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: wallet.color }} />
                  <div className="text-[13px] text-foreground">{wallet.name}</div>
                </div>
                <div className="num text-[22px] font-medium tracking-tight text-foreground">{formatMoney(balance)}</div>
                <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                  <span>In: <span className="num text-foreground">{formatMoney(credited)}</span></span>
                  <span>Out: <span className="num text-foreground">{formatMoney(spent)}</span></span>
                </div>
              </div>
            ))}
          </section>

          {balances.length > 0 && (
            <div className="rounded-md border border-border bg-surface px-5 py-3 flex items-center justify-between">
              <div className="label-mono">Total Balance</div>
              <div className="num text-[16px] font-medium">{formatMoney(totalBalance)}</div>
            </div>
          )}
        <section className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <div className="label-mono">History</div>
        </div>
            {transfers.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-muted-foreground">No transfers yet.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="label-mono">
                    <th className="px-5 py-3 text-left font-normal">Date</th>
                    <th className="px-5 py-3 text-left font-normal">From → To</th>
                    <th className="px-5 py-3 text-left font-normal">Notes</th>
                    <th className="px-5 py-3 text-right font-normal">Amount</th>
                    <th className="w-[80px] px-5 py-3 text-right font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id} className="h-11 border-t border-border">
                      <td className="num px-5 text-[13px]">
                        {new Date(t.date).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}
                      </td>
                      <td className="px-5 text-[13px]">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: walletColor(t.from_wallet_id) }} />
                          {walletName(t.from_wallet_id)}
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: walletColor(t.to_wallet_id) }} />
                          {walletName(t.to_wallet_id)}
                        </span>
                      </td>
                      <td className="px-5 text-[12px] text-muted-foreground">{t.notes ?? ""}</td>
                      <td className="num px-5 text-right text-[13px]">{formatMoney(Number(t.amount))}</td>
                      <td className="px-5 text-right">
                        <button
                          onClick={() => delTransfer(t.id)}
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
            )}
          </section>
    </AppLayout>
  );
}
