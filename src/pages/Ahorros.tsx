import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthSelector } from "@/components/MonthSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Trash2, Plus, ArrowDownToLine, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface SavingsGoal {
  id: string;
  name: string;
  goal_amount: number | null;
  color: string;
  created_at: string;
  active?: boolean;
}

interface SavingsDeposit {
  id: string;
  savings_id: string;
  amount: number;
  wallet_account_id: string | null;
  date: string;
  notes: string | null;
  type?: "IN" | "OUT";
}

export default function Savings() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [deposits, setDeposits] = useState<SavingsDeposit[]>([]);
  const [wallets, setWallets] = useState<{ id: string; name: string; color: string }[]>([]);
  const [month, setMonth] = useState(new Date());
  const [filter, setFilter] = useState<"all" | "IN" | "OUT">("all");

  const [goalOpen, setGoalOpen] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalColor, setGoalColor] = useState("#10b981");

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositGoalId, setDepositGoalId] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositWalletId, setDepositWalletId] = useState("");
  const [depositDate, setDepositDate] = useState(new Date());

  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawGoalId, setWithdrawGoalId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawWalletId, setWithdrawWalletId] = useState("");
  const [withdrawDate, setWithdrawDate] = useState(new Date());

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeGoalId, setCompleteGoalId] = useState<string | null>(null);
  const [completeWithWithdraw, setCompleteWithWithdraw] = useState(false);
  const [completeWalletId, setCompleteWalletId] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    const [g, d, w] = await Promise.all([
      supabase.from("savings").select("*").order("created_at", { ascending: false }),
      supabase.from("savings_deposits").select("*").order("date", { ascending: false }),
      supabase.from("wallet_accounts").select("*").order("name"),
    ]);
    setGoals((g.data ?? []) as SavingsGoal[]);
    setDeposits((d.data ?? []) as SavingsDeposit[]);
    setWallets((w.data ?? []) as { id: string; name: string; color: string }[]);
  }

  async function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalName.trim()) return toast.error("Enter a name.");
    const amt = goalAmount ? parseFloat(goalAmount) : null;
    const { error } = await supabase.from("savings").insert({
      name: goalName.trim(),
      goal_amount: amt,
      color: goalColor,
    });
    if (error) return toast.error(error.message);
    toast.success("Goal created!");
    setGoalOpen(false);
    setGoalName("");
    setGoalAmount("");
    setGoalColor("#10b981");
    void load();
  }

  async function deleteGoal(id: string) {
    if (!confirm("Delete this goal?")) return;
    const { error } = await supabase.from("savings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Goal deleted");
    void load();
  }

  async function saveDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!depositGoalId) return toast.error("Select a savings goal.");
    const amt = parseFloat(depositAmount);
    if (!amt || amt <= 0) return toast.error("Enter an amount.");
    if (!depositWalletId) return toast.error("Select a wallet.");
    const today = depositDate.toISOString().split("T")[0];

    await supabase.from("savings_deposits").insert({
      savings_id: depositGoalId,
      amount: amt,
      wallet_account_id: depositWalletId,
      date: today,
      type: "IN",
    });

    await supabase.from("expenses").insert({
      wallet_account_id: depositWalletId,
      category_id: "eba49489-34f8-4b92-8056-fa8449540216",
      amount: amt,
      date: today,
      is_fixed: false,
      is_paid: true,
      paid_date: today,
      description: `Savings: ${goals.find(g => g.id === depositGoalId)?.name ?? ""}`,
    });

    toast.success("Deposit added!");
    setDepositOpen(false);
    setDepositGoalId("");
    setDepositAmount("");
    setDepositWalletId("");
    setDepositDate(new Date());
    void load();
  }

  async function deleteDeposit(id: string) {
    if (!confirm("Delete this deposit?")) return;
    const deposit = deposits.find(d => d.id === id);
    if (!deposit) return;
    const { error } = await supabase.from("savings_deposits").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (deposit.wallet_account_id) {
      await supabase.from("expenses").delete().match({
        wallet_account_id: deposit.wallet_account_id,
        amount: deposit.amount,
        description: `Savings: ${goals.find(g => g.id === deposit.savings_id)?.name ?? ""}`,
      });
    }
    toast.success("Deposit deleted");
    void load();
  }

  async function saveWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!withdrawGoalId) return toast.error("Select a savings goal.");
    if (!withdrawWalletId) return toast.error("Select a wallet.");
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) return toast.error("Enter an amount.");
    const today = withdrawDate.toISOString().split("T")[0];

    await supabase.from("savings_deposits").insert({
      savings_id: withdrawGoalId,
      amount: amt,
      wallet_account_id: withdrawWalletId,
      date: today,
      type: "OUT",
    });

    await supabase.from("extra_income").insert({
      amount: amt,
      wallet_account_id: withdrawWalletId,
      date: today,
      concept: `Savings withdrawal: ${goals.find(g => g.id === withdrawGoalId)?.name ?? ""}`,
    });

    toast.success("Withdrawal added!");
    setWithdrawOpen(false);
    setWithdrawGoalId("");
    setWithdrawAmount("");
    setWithdrawWalletId("");
    setWithdrawDate(new Date());
    void load();
  }

  async function confirmCompleteGoal() {
    if (!completeGoalId) return;
    const goal = goals.find(g => g.id === completeGoalId);
    if (!goal) return;
    const goalDeposits = deposits.filter(d => d.savings_id === completeGoalId);
    const inAmt = goalDeposits.filter(d => d.type === "IN" || !d.type).reduce((s, d) => s + Number(d.amount), 0);
    const outAmt = goalDeposits.filter(d => d.type === "OUT").reduce((s, d) => s + Number(d.amount), 0);
    const available = inAmt - outAmt;
    const today = new Date().toISOString().split("T")[0];

    if (completeWithWithdraw && completeWalletId && available > 0) {
      await supabase.from("savings_deposits").insert({
        savings_id: completeGoalId,
        amount: available,
        wallet_account_id: completeWalletId,
        date: today,
        type: "OUT",
      });
      await supabase.from("extra_income").insert({
        amount: available,
        wallet_account_id: completeWalletId,
        date: today,
        concept: `Goal completed: ${goal.name}`,
      });
    }

    const { error } = await supabase.from("savings").update({ active: false }).eq("id", completeGoalId);
    if (error) return toast.error(error.message);
    toast.success(completeWithWithdraw ? "Goal completed! Money withdrawn to wallet." : "Goal marked as completed!");
    setCompleteOpen(false);
    setCompleteGoalId(null);
    setCompleteWithWithdraw(false);
    setCompleteWalletId("");
    void load();
  }

  function openCompleteDialog(id: string) {
    setCompleteGoalId(id);
    setCompleteWithWithdraw(false);
    setCompleteWalletId("");
    setCompleteOpen(true);
  }

  const activeGoals = goals.filter(g => g.active !== false);
  const filtered = filter === "all" ? deposits : deposits.filter(d => d.type === filter || (!d.type && filter === "IN"));
  const totalIn = deposits.filter(d => d.type === "IN" || !d.type).reduce((s, d) => s + Number(d.amount), 0);
  const totalOut = deposits.filter(d => d.type === "OUT").reduce((s, d) => s + Number(d.amount), 0);
  const totalSaved = totalIn - totalOut;

  const getGoalName = (id: string) => goals.find(g => g.id === id)?.name ?? "";
  const getGoalColor = (id: string) => goals.find(g => g.id === id)?.color ?? "#888";
  const getWalletName = (id: string | null) => id ? wallets.find(w => w.id === id)?.name ?? "" : "";

  return (
    <AppLayout
      title="Savings"
      subtitle="Track your savings goals and deposits"
      actions={
        <div className="flex gap-2">
          <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />Add Goal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader><DialogTitle>New Savings Goal</DialogTitle></DialogHeader>
              <form onSubmit={saveGoal} className="space-y-4">
                <div><div className="label-mono mb-2">Name</div><Input placeholder="e.g., Vacation, Car, Emergency fund" value={goalName} onChange={(e) => setGoalName(e.target.value)} autoFocus /></div>
                <div>
                  <div className="label-mono mb-2">Goal Amount (optional)</div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                    <Input className="num pl-6 text-[15px]" placeholder="0.00" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} inputMode="decimal" />
                  </div>
                </div>
                <div>
                  <div className="label-mono mb-2">Color</div>
                  <div className="flex gap-2">
                    {["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"].map((c) => (
                      <button key={c} type="button" onClick={() => setGoalColor(c)} className={`h-8 w-8 rounded-full border-2 ${goalColor === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setGoalOpen(false)}>Cancel</Button>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" strokeWidth={1.8} />Add Deposit</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader><DialogTitle>Add Deposit</DialogTitle></DialogHeader>
              <form onSubmit={saveDeposit} className="space-y-4">
                <div>
                  <div className="label-mono mb-2">Savings Goal</div>
                  <Select value={depositGoalId} onValueChange={setDepositGoalId}>
                    <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
                    <SelectContent>
                      {activeGoals.map((g) => (<SelectItem key={g.id} value={g.id}><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />{g.name}</span></SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="label-mono mb-2">Amount</div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                    <Input className="num pl-6 text-[15px]" placeholder="0.00" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} inputMode="decimal" autoFocus />
                  </div>
                </div>
                <div>
                  <div className="label-mono mb-2">Wallet</div>
                  <Select value={depositWalletId} onValueChange={setDepositWalletId}>
                    <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
                    <SelectContent>
                      {wallets.map((w) => (<SelectItem key={w.id} value={w.id}><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color }} />{w.name}</span></SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div><div className="label-mono mb-2">Date</div><MonthSelector value={depositDate} onChange={setDepositDate} /></div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setDepositOpen(false)}>Cancel</Button>
                  <Button type="submit">Add</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={1.8} />Withdraw
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader><DialogTitle>Withdraw from Savings</DialogTitle></DialogHeader>
              <form onSubmit={saveWithdraw} className="space-y-4">
                <div>
                  <div className="label-mono mb-2">Savings Goal</div>
                  <Select value={withdrawGoalId} onValueChange={setWithdrawGoalId}>
                    <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
                    <SelectContent>
                      {activeGoals.map((g) => (<SelectItem key={g.id} value={g.id}><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />{g.name}</span></SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="label-mono mb-2">Amount</div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                    <Input className="num pl-6 text-[15px]" placeholder="0.00" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} inputMode="decimal" autoFocus />
                  </div>
                </div>
                <div>
                  <div className="label-mono mb-2">Wallet</div>
                  <Select value={withdrawWalletId} onValueChange={setWithdrawWalletId}>
                    <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
                    <SelectContent>
                      {wallets.map((w) => (<SelectItem key={w.id} value={w.id}><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color }} />{w.name}</span></SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div><div className="label-mono mb-2">Date</div><MonthSelector value={withdrawDate} onChange={setWithdrawDate} /></div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
                  <Button type="submit">Withdraw</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="label-mono mb-1">Total In</div>
            <div className="text-[24px] font-medium num text-success">{formatMoney(totalIn)}</div>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="label-mono mb-1">Total Out</div>
            <div className="text-[24px] font-medium num text-destructive">-{formatMoney(totalOut)}</div>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <div className="label-mono mb-1">Net</div>
            <div className="text-[24px] font-medium num">{formatMoney(totalSaved)}</div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setFilter("all")} className={cn("px-3 py-1 text-[11px] rounded-full border transition-colors", filter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-surface text-muted-foreground border-border hover:border-muted-foreground")}>All ({deposits.length})</button>
          <button type="button" onClick={() => setFilter("IN")} className={cn("px-3 py-1 text-[11px] rounded-full border transition-colors", filter === "IN" ? "bg-success/20 text-success border-success/50" : "bg-surface text-muted-foreground border-border hover:border-muted-foreground")}>In ({deposits.filter(d => d.type === "IN" || !d.type).length})</button>
          <button type="button" onClick={() => setFilter("OUT")} className={cn("px-3 py-1 text-[11px] rounded-full border transition-colors", filter === "OUT" ? "bg-destructive/20 text-destructive border-destructive/50" : "bg-surface text-muted-foreground border-border hover:border-muted-foreground")}>Out ({deposits.filter(d => d.type === "OUT").length})</button>
        </div>

        <section className="rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="label-mono">Savings Goals</div>
            <span className="text-[11px] text-muted-foreground">{goals.length} goals</span>
          </div>
          {goals.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-muted-foreground">No savings goals yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
              {goals.map((g) => {
                const gd = deposits.filter(d => d.savings_id === g.id);
                const inAmt = gd.filter(d => d.type === "IN" || !d.type).reduce((s, d) => s + Number(d.amount), 0);
                const outAmt = gd.filter(d => d.type === "OUT").reduce((s, d) => s + Number(d.amount), 0);
                const saved = inAmt - outAmt;
                const progress = g.goal_amount ? (saved / Number(g.goal_amount)) * 100 : null;
                const isCompleted = g.active === false;
                return (
                  <div key={g.id} className="rounded-md border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="font-medium text-[14px]">{g.name}</span>
                        {isCompleted && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Completed</span>}
                      </div>
                      {!isCompleted && progress !== null && progress >= 100 && <button onClick={() => openCompleteDialog(g.id)} className="rounded p-1 text-success hover:bg-success/10"><CheckCircle className="h-3.5 w-3.5" /></button>}
                      {!isCompleted && (progress === null || progress < 100) && <button onClick={() => deleteGoal(g.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                    <div className="num text-[18px] mb-1">{formatMoney(saved)}</div>
                    {progress !== null && (<><div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: g.color }} /></div><div className="text-[10px] text-muted-foreground mt-1">{progress.toFixed(0)}% of {formatMoney(Number(g.goal_amount))}</div></>)}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="label-mono">Deposits</div>
            <MonthSelector value={month} onChange={setMonth} />
          </div>
          {filtered.length === 0 ? (<div className="py-10 text-center text-[12px] text-muted-foreground">No deposits yet.</div>) : (
            <div className="overflow-x-auto"><table className="w-full"><thead><tr className="label-mono"><th className="px-5 py-3 text-left font-normal">Goal</th><th className="px-5 py-3 text-left font-normal">Type</th><th className="px-5 py-3 text-left font-normal">Wallet</th><th className="px-5 py-3 text-left font-normal">Date</th><th className="px-5 py-3 text-right font-normal">Amount</th><th className="w-[60px] px-5 py-3 text-right font-normal"></th></tr></thead><tbody>{filtered.map((d) => (<tr key={d.id} className="group h-11 border-t border-border"><td className="px-5 text-[13px]"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: getGoalColor(d.savings_id) }} />{getGoalName(d.savings_id)}</span></td><td className="px-5 py-3"><span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", d.type === "OUT" ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success")}>{d.type === "OUT" ? "Out" : "In"}</span></td><td className="px-5 text-[13px] text-muted-foreground">{getWalletName(d.wallet_account_id)}</td><td className="px-5 text-[13px] text-muted-foreground whitespace-nowrap">{new Date(d.date).toLocaleDateString("en-US", { day: "numeric", month: "short" })}</td><td className={cn("px-5 text-right text-[13px] num", d.type === "OUT" ? "text-destructive" : "text-success")}>{d.type === "OUT" ? "-" : "+"}{formatMoney(Number(d.amount))}</td><td className="px-5 text-right"><button onClick={() => deleteDeposit(d.id)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"><Trash2 className="h-4 w-4" strokeWidth={1.5} /></button></td></tr>))}</tbody></table></div>
          )}
        </section>
      </div>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Complete Goal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">This goal has reached 100%. Mark it as completed?</p>
            <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-surface">
              <input type="checkbox" id="withdrawToWallet" checked={completeWithWithdraw} onChange={(e) => setCompleteWithWithdraw(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="withdrawToWallet" className="text-sm cursor-pointer">Withdraw available money to wallet</label>
            </div>
            {completeWithWithdraw && wallets.length > 0 && (
              <div>
                <div className="label-mono mb-2">Wallet</div>
                <Select value={completeWalletId} onValueChange={setCompleteWalletId}>
                  <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
                  <SelectContent>
                    {wallets.map((w) => (<SelectItem key={w.id} value={w.id}><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color }} />{w.name}</span></SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {completeWithWithdraw && completeWalletId && deposits.filter(d => d.savings_id === completeGoalId && (d.type === "IN" || !d.type)).length > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatMoney(deposits.filter(d => d.savings_id === completeGoalId && (d.type === "IN" || !d.type)).reduce((s, d) => s + Number(d.amount), 0) - deposits.filter(d => d.savings_id === completeGoalId && d.type === "OUT").reduce((s, d) => s + Number(d.amount), 0))} will be added to the wallet as extra income.
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCompleteOpen(false)}>Cancel</Button>
              <Button type="button" onClick={confirmCompleteGoal}>Complete</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}