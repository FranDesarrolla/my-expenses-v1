import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, endOfMonth } from "date-fns";
import { ChevronDown, ChevronRight, Trash2, Pencil, Check, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { startOfMonthISO, endOfMonthISO, formatMoney } from "@/lib/format";
import { toast } from "sonner";

interface Category { id: string; name: string; color: string }
interface Card { id: string; name: string; color: string }
interface Wallet { id: string; name: string; color: string }
interface Expense {
  id: string; amount: number; description: string | null; date: string;
  category_id: string | null; wallet_account_id: string | null;
}
interface ExpensePayment {
  id: string;
  expense_id: string;
  amount: number;
  wallet_account_id: string | null;
  date: string;
  paid: boolean;
  paid_at: string | null;
}
interface FixedExpense {
  id: string; amount: number; description: string;
  category_id: string | null; wallet_account_id: string | null;
}
interface FixedPayment { id?: string; fixed_expense_id: string; month: string; paid: boolean; amount?: number }
interface Charge {
  id: string; description: string; card_id: string; category_id: string | null;
  type: string; monthly_amount: number; total_installments: number;
  current_installment: number; start_date: string; end_date: string | null; active: boolean;
}
interface CardPayment { id: string; card_id: string; month: string; amount: number }

export interface MonthlyExpensesListProps {
  month: Date;
  /** When true, show paid toggles, edit/delete actions. When false, read-only. */
  interactive?: boolean;
  /** Reload trigger — change to force a refresh from parent. */
  refreshKey?: number;
}

type EditState =
  | { kind: "expense"; id: string; amount: string; description: string; category_id: string; wallet_account_id: string; date: string }
  | { kind: "fixed"; id: string; amount: string; description: string; category_id: string; wallet_account_id: string }
  | { kind: "charge"; id: string; description: string; amount: string; category_id: string }
  | null;

export function MonthlyExpensesList({ month, interactive = false, refreshKey = 0 }: MonthlyExpensesListProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [fixedPays, setFixedPays] = useState<FixedPayment[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [cardPays, setCardPays] = useState<CardPayment[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<EditState>(null);
  const [loading, setLoading] = useState(true);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payDialogAmount, setPayDialogAmount] = useState("");
  const [payDialogFixedExpense, setPayDialogFixedExpense] = useState<FixedExpense | null>(null);
  const [editExpenseDialogOpen, setEditExpenseDialogOpen] = useState(false);
  const [editExpenseData, setEditExpenseData] = useState<{
    id: string;
    amount: string;
    description: string;
    category_id: string;
    wallet_account_id: string;
    date: string;
    paid: boolean;
  } | null>(null);

  const monthISO = startOfMonthISO(month);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, refreshKey]);

  async function load() {
    setLoading(true);
    const start = startOfMonthISO(month);
    const end = endOfMonthISO(month);
    const [exps, fxs, fxPays, chs, cp, cds, ctgs, ws, expPays] = await Promise.all([
      supabase.from("expenses").select("id, amount, description, date, category_id, wallet_account_id").gte("date", start).lte("date", end).order("date", { ascending: false }),
      supabase.from("fixed_expenses").select("*").lte("start_date", end).or("end_date.is.null,end_date.gte." + start).order("description"),
      supabase.from("fixed_expense_payments").select("*").eq("month", start),
      supabase.from("card_charges").select("*"),
      (supabase.from("card_payments" as any).select("id, card_id, month, amount") as any),
      supabase.from("cards").select("*"),
      supabase.from("categories").select("*"),
      supabase.from("wallet_accounts").select("*"),
      (supabase.from("expense_payments" as any).select("*") as any),
    ]);
    setExpenses((exps.data ?? []) as Expense[]);
    setExpensePayments((expPays.data ?? []) as ExpensePayment[]);
    setFixed((fxs.data ?? []) as FixedExpense[]);
    setFixedPays((fxPays.data ?? []) as FixedPayment[]);
    setCharges((chs.data ?? []) as Charge[]);
    setCardPays((cp.data ?? []) as CardPayment[]);
    setCards(cds.data ?? []);
    setCats(ctgs.data ?? []);
    setWallets((ws.data ?? []) as Wallet[]);
    setEdit(null);
    setLoading(false);
  }

  // Get fixed expense view with payment amount if available
  function getFixedView(f: FixedExpense) {
    const payment = fixedPays.find(p => p.fixed_expense_id === f.id && p.month === monthISO);
    return {
      id: f.id,
      amount: payment?.amount ?? Number(f.amount),
      description: f.description,
      category_id: f.category_id,
      wallet_account_id: f.wallet_account_id,
    };
  }

  const fixedViews = useMemo(() => fixed.map(getFixedView), [fixed, fixedPays, monthISO]);

  // Active charges for selected month + computed installment progress
  const monthCharges = useMemo(() => {
    return charges
      .map((c) => {
        const start = new Date(c.start_date);
        const monthsSinceStart =
          (month.getFullYear() - start.getFullYear()) * 12 + (month.getMonth() - start.getMonth());
        let inMonth = false;
        if (c.type === "one-time") {
          inMonth = start.getFullYear() === month.getFullYear() && start.getMonth() === month.getMonth();
        } else if (c.type === "installment") {
          inMonth = monthsSinceStart >= 0 && monthsSinceStart < c.total_installments;
        } else {
          if (monthsSinceStart < 0) {
            inMonth = false;
          } else if (!c.end_date) {
            inMonth = true;
          } else {
            const end = new Date(c.end_date);
            const monthsUntilEnd = (end.getFullYear() - month.getFullYear()) * 12 + (end.getMonth() - month.getMonth());
            inMonth = monthsUntilEnd >= 0;
          }
        }
        const currentInst =
          c.type === "installment" ? Math.min(c.total_installments, monthsSinceStart + 1) : 1;
        return { ...c, _inMonth: inMonth, currentInst };
      })
      .filter((c) => c._inMonth);
  }, [charges, month]);

  // Group charges by card
  const chargeGroups = useMemo(() => {
    return cards
      .map((card) => {
        const list = monthCharges.filter((c) => c.card_id === card.id);
        const subtotal = list.reduce((s, c) => s + Number(c.monthly_amount), 0);
        const isCardPaid = cardPays.some((p) => p.card_id === card.id && p.month === monthISO);
        return { card, list, subtotal, isCardPaid };
      })
      .filter((g) => g.list.length > 0);
  }, [cards, monthCharges, cardPays, monthISO]);

  const isChargePaid = (chargeId: string) => {
    const charge = charges.find((c) => c.id === chargeId);
    if (!charge) return false;
    return cardPays.some((p) => p.card_id === charge.card_id && p.month === monthISO);
  };

  const isFixedPaid = (fxId: string) =>
    fixedPays.find((p) => p.fixed_expense_id === fxId)?.paid ?? false;

  const isExpensePaid = (expenseId: string) =>
    expensePayments.find((p) => p.expense_id === expenseId && p.paid)?.paid ?? false;

  const getFixedExpenseAmount = (fx: FixedExpense) => {
    const payment = fixedPays.find(p => p.fixed_expense_id === fx.id && p.month === monthISO);
    return payment?.amount ?? fx.amount;
  };

  const openPayDialog = (fx: FixedExpense) => {
    setPayDialogFixedExpense(fx);
    setPayDialogAmount(String(fx.amount));
    setPayDialogOpen(true);
  };

  // ==== Mutations ====
  async function setExpensePaid(id: string, paid: boolean) {
    const expense = expenses.find(e => e.id === id);
    const today = format(new Date(), "yyyy-MM-dd");
    
    if (paid && expense) {
      const { data: existing } = await supabase
        .from("expense_payments" as any)
        .select("id")
        .eq("expense_id", id)
        .maybeSingle();
      
      if (existing) {
        await supabase.from("expense_payments" as any)
          .update({ paid: true, paid_at: today } as any)
          .eq("expense_id", id);
      } else {
        await supabase.from("expense_payments" as any).insert({
          expense_id: id,
          amount: expense.amount,
          wallet_account_id: expense.wallet_account_id,
          date: today,
          paid: true,
          paid_at: today,
        } as any);
      }
    } else if (!paid) {
      await supabase.from("expense_payments" as any)
        .update({ paid: false, paid_at: null } as any)
        .eq("expense_id", id);
    }
    
    // Update local state - add new entry if not exists, otherwise update
    setExpensePayments((prev) => {
      const exists = prev.find(p => p.expense_id === id);
      if (exists) {
        return prev.map(p => p.expense_id === id ? { ...p, paid } : p);
      } else if (paid && expense) {
        return [...prev, {
          id: crypto.randomUUID(),
          expense_id: id,
          amount: expense.amount,
          wallet_account_id: expense.wallet_account_id,
          date: today,
          paid: true,
          paid_at: today,
        }];
      }
      return prev;
    });
  }

  async function deleteExpense(id: string) {
    await supabase.from("expense_payments").delete().eq("expense_id", id);
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    toast.success("Expense removed.");
  }

  async function saveExpenseEdit() {
    if (!editExpenseData) return;
    const amt = parseFloat(editExpenseData.amount);
    if (!amt || amt <= 0) return toast.error("Amount required.");
    
    const { error } = await supabase.from("expenses").update({
      amount: amt,
      description: editExpenseData.description.trim() || null,
      category_id: editExpenseData.category_id || null,
      wallet_account_id: editExpenseData.wallet_account_id || null,
      date: editExpenseData.date,
    }).eq("id", editExpenseData.id);
    if (error) return toast.error(error.message);
    
    const today = format(new Date(), "yyyy-MM-dd");
    const existingPayment = expensePayments.find(p => p.expense_id === editExpenseData.id && p.paid);
    
    if (editExpenseData.paid) {
      if (existingPayment) {
        await supabase.from("expense_payments" as any)
          .update({ 
            amount: amt,
            wallet_account_id: editExpenseData.wallet_account_id || null,
            paid: true, 
            paid_at: today 
          } as any)
          .eq("expense_id", editExpenseData.id);
      } else {
        await supabase.from("expense_payments" as any).insert({
          expense_id: editExpenseData.id,
          amount: amt,
          wallet_account_id: editExpenseData.wallet_account_id || null,
          date: today,
          paid: true,
          paid_at: today,
        } as any);
      }
    } else if (existingPayment) {
      await supabase.from("expense_payments" as any)
        .update({ paid: false, paid_at: null } as any)
        .eq("expense_id", editExpenseData.id);
    }
    
    toast.success("Expense updated.");
    setEditExpenseDialogOpen(false);
    setEditExpenseData(null);
    void load();
  }

  async function setFixedPaid(fxId: string, paid: boolean, amount?: number) {
    const monthStr = startOfMonthISO(month);
    const today = format(new Date(), "yyyy-MM-dd");
    const amt = amount ?? 0;
    
    if (paid) {
      const { data: existing } = await supabase
        .from("fixed_expense_payments" as any)
        .select("id")
        .eq("fixed_expense_id", fxId)
        .eq("month", monthStr)
        .maybeSingle();
      
      if (existing) {
        await supabase.from("fixed_expense_payments" as any)
          .update({ paid_at: today, paid: true, amount: amt } as any)
          .eq("fixed_expense_id", fxId)
          .eq("month", monthStr);
      } else {
        await supabase.from("fixed_expense_payments" as any).insert({
          fixed_expense_id: fxId,
          month: monthStr,
          paid: true,
          paid_at: today,
          amount: amt,
        } as any);
      }
    } else {
      await supabase.from("fixed_expense_payments" as any)
        .update({ paid_at: null, paid: false } as any)
        .eq("fixed_expense_id", fxId)
        .eq("month", monthStr);
    }
    
    // Update local state - add new entry if not exists, otherwise update
    setFixedPays((prev) => {
      const exists = prev.find(p => p.fixed_expense_id === fxId && p.month === monthStr);
      if (exists) {
        return prev.map(p => p.fixed_expense_id === fxId && p.month === monthStr ? { ...p, paid, amount: paid ? amt : p.amount } : p);
      } else if (paid) {
        return [...prev, {
          id: crypto.randomUUID(),
          fixed_expense_id: fxId,
          month: monthStr,
          paid: true,
          amount: amt,
        }];
      }
      return prev;
    });
  }

  async function confirmPayFixedExpense() {
    if (!payDialogFixedExpense) return;
    const amt = parseFloat(payDialogAmount);
    if (!amt || amt <= 0) {
      toast.error("Amount required.");
      return;
    }
    await setFixedPaid(payDialogFixedExpense.id, true, amt);
    setPayDialogOpen(false);
    setPayDialogFixedExpense(null);
    toast.success("Payment recorded.");
  }

  /** Skip this fixed expense for the current month only (does not delete the template). */
  async function skipFixedThisMonth(fxId: string) {
    if (!confirm("Remove this fixed expense from the current month? The template stays intact.")) return;
    await supabase.from("fixed_expense_payments")
      .delete().eq("fixed_expense_id", fxId).eq("month", monthISO);
    setFixedPays((prev) => prev.filter((p) => !(p.fixed_expense_id === fxId && p.month === monthISO)));
    toast.success("Removed from this month.");
  }

  /** Save edit - updates payment amount for current month. */
  async function saveFixedEdit() {
    if (edit?.kind !== "fixed") return;
    const amt = parseFloat(edit.amount);
    if (!amt || amt <= 0) return toast.error("Amount required.");
    const today = format(new Date(), "yyyy-MM-dd");
    const { data: existing } = await supabase
      .from("fixed_expense_payments" as any)
      .select("id")
      .eq("fixed_expense_id", edit.id)
      .eq("month", monthISO)
      .maybeSingle();
    if (existing) {
      await supabase.from("fixed_expense_payments" as any)
        .update({ amount: amt, paid_at: today, paid: true } as any)
        .eq("fixed_expense_id", edit.id)
        .eq("month", monthISO);
    } else {
      await supabase.from("fixed_expense_payments" as any).insert({
        fixed_expense_id: edit.id,
        month: monthISO,
        amount: amt,
        paid: true,
        paid_at: today,
      } as any);
    }
    setFixedPays((prev) => {
      const idx = prev.findIndex(p => p.fixed_expense_id === edit.id && p.month === monthISO);
      if (idx >= 0) {
        return prev.map((p, i) => i === idx ? { ...p, amount: amt, paid: true } : p);
      }
      return [...prev, { id: crypto.randomUUID(), fixed_expense_id: edit.id, month: monthISO, paid: true, amount: amt }];
    });
    setEdit(null);
    toast.success("Updated for this month.");
  }

  async function setChargePaid(chargeId: string, paid: boolean) {
    const existing = chargePays.find((p) => p.charge_id === chargeId);
    if (existing?.id) {
      setChargePays((prev) => prev.map((p) => (p.id === existing.id ? { ...p, paid } : p)));
      const { error } = await supabase.from("charge_payments").update({ paid }).eq("id", existing.id);
      if (error) { toast.error(error.message); void load(); }
    } else {
      const { data, error } = await supabase
        .from("charge_payments")
        .insert({ charge_id: chargeId, month: monthISO, paid })
        .select()
        .single();
      if (error) { toast.error(error.message); return; }
      setChargePays((prev) => [...prev, data as ChargePayment]);
    }
  }

  async function setCardGroupPaid(cardId: string, paid: boolean) {
    const group = chargeGroups.find((g) => g.card.id === cardId);
    if (!group) return;
    await Promise.all(group.list.map((c) => setChargePaid(c.id, paid)));
  }

  async function deleteCharge(id: string) {
    if (!confirm("Delete this charge entirely?")) return;
    const { error } = await supabase.from("card_charges").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Charge removed.");
    void load();
  }

  async function saveChargeEdit() {
    if (edit?.kind !== "charge") return;
    const amt = parseFloat(edit.amount);
    if (!amt || amt <= 0) return toast.error("Amount required.");
    const { error } = await supabase.from("card_charges").update({
      description: edit.description.trim(),
      monthly_amount: amt,
      category_id: edit.category_id || null,
    }).eq("id", edit.id);
    if (error) return toast.error(error.message);
    toast.success("Charge updated.");
    void load();
  }

  // Totals (skipped fixed = amount 0)
  const totals = useMemo(() => {
    const exp = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const fx = fixedViews.reduce((s, f) => s + Number(f.amount), 0);
    const ch = chargeGroups.reduce((s, g) => s + g.subtotal, 0);
    return { exp, fx, ch, grand: exp + fx + ch };
  }, [expenses, fixedViews, chargeGroups]);

  if (loading) {
    return <div className="py-8 text-center text-[12px] text-muted-foreground">Loading…</div>;
  }

  const visibleFixed = fixedViews.filter((f) => f.amount > 0);
  const empty = expenses.length === 0 && visibleFixed.length === 0 && chargeGroups.length === 0;
  if (empty) {
    return <div className="py-10 text-center text-[12px] text-muted-foreground">No records for this month.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Regular Expenses */}
      {expenses.length > 0 && (
        <SectionBlock title="Expenses" subtotal={totals.exp}>
          <table className="w-full">
            <thead>
              <tr className="label-mono">
                <th className="px-4 py-2 text-left font-normal">Date</th>
                <th className="px-4 py-2 text-left font-normal">Description</th>
                <th className="px-4 py-2 text-left font-normal">Category</th>
                <th className="px-4 py-2 text-right font-normal">Amount</th>
                <th className="w-[110px] px-4 py-2 text-right font-normal">Status</th>
                {interactive && <th className="w-[80px] px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => {
                const cat = cats.find((c) => c.id === e.category_id);
                return (
                  <tr key={e.id} className="group h-11 border-t border-border">
                    <td className="num px-4 text-[12px] text-muted-foreground">
                      {format(new Date(e.date + "T00:00:00"), "MMM dd")}
                    </td>
                    <td className="px-4 text-[13px]">{e.description ?? "—"}</td>
                    <td className="px-4 text-[13px]">
                      <CategoryCell cat={cat} />
                    </td>
                    <td className="num px-4 text-right text-[13px]">{formatMoney(Number(e.amount))}</td>
                    <td className="px-4 text-right">
                      <PaidStatus
                        paid={isExpensePaid(e.id)}
                        interactive={interactive}
                        onChange={(v) => setExpensePaid(e.id, v)}
                      />
                    </td>
                    {interactive && (
                      <td className="px-4 text-right">
                        <RowActions
                          onEdit={() => {
                            const payment = expensePayments.find(p => p.expense_id === e.id && p.paid);
                            setEditExpenseData({
                              id: e.id,
                              amount: String(e.amount),
                              description: e.description ?? "",
                              category_id: e.category_id ?? "",
                              wallet_account_id: e.wallet_account_id ?? "",
                              date: e.date,
                              paid: payment?.paid ?? false,
                            });
                            setEditExpenseDialogOpen(true);
                          }}
                          onDelete={() => deleteExpense(e.id)}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionBlock>
      )}

      {/* Fixed Expenses (per-month view) */}
      {visibleFixed.length > 0 && (
        <SectionBlock title="Fixed Expenses" subtotal={totals.fx}>
          <table className="w-full">
            <thead>
              <tr className="label-mono">
                <th className="px-4 py-2 text-left font-normal">Description</th>
                <th className="px-4 py-2 text-left font-normal">Category</th>
                <th className="px-4 py-2 text-right font-normal">Amount</th>
                <th className="w-[110px] px-4 py-2 text-right font-normal">Status</th>
                {interactive && <th className="w-[80px] px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {visibleFixed.map((f) => {
                const cat = cats.find((c) => c.id === f.category_id);
                const isEditing = edit?.kind === "fixed" && edit.id === f.id;
                if (isEditing) {
                  return (
                    <tr key={f.id} className="border-t border-border bg-accent/30">
                      <td className="px-4 py-2">
                        <Input value={edit.description}
                          onChange={(ev) => setEdit({ ...edit, description: ev.target.value })}
                          className="h-8 text-[12.5px]" />
                      </td>
                      <td className="px-4 py-2">
                        <CategorySelect cats={cats} value={edit.category_id}
                          onChange={(v) => setEdit({ ...edit, category_id: v })} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Input value={edit.amount} inputMode="decimal"
                          onChange={(ev) => setEdit({ ...edit, amount: ev.target.value })}
                          className="num h-8 text-right text-[12.5px]" />
                      </td>
                      <td className="px-4 text-right">
                        <WalletSelect wallets={wallets} value={edit.wallet_account_id}
                          onChange={(v) => setEdit({ ...edit, wallet_account_id: v })} />
                      </td>
                      <td className="px-2 text-right">
                        <EditActions onSave={saveFixedEdit} onCancel={() => setEdit(null)} />
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={f.id} className="group h-11 border-t border-border">
                    <td className="px-4 text-[13px]">
                      <span className="inline-flex items-center gap-2">
                        {f.description}
                        <span className="num rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">Fixed</span>
                      </span>
                    </td>
                    <td className="px-4 text-[13px]"><CategoryCell cat={cat} /></td>
                    <td className="num px-4 text-right text-[13px]">{formatMoney(Number(getFixedExpenseAmount(f)))}</td>
                    <td className="px-4 text-right">
                      <PaidStatus
                        paid={isFixedPaid(f.id)}
                        interactive={interactive}
                        onChange={(v) => v ? openPayDialog(f) : setFixedPaid(f.id, false)}
                      />
                    </td>
                    {interactive && (
                      <td className="px-4 text-right">
                        <RowActions
                          onEdit={() => setEdit({
                            kind: "fixed", id: f.id,
                            amount: String(f.amount),
                            description: f.description,
                            category_id: f.category_id ?? "",
                            wallet_account_id: f.wallet_account_id ?? "",
                          })}
                          onDelete={() => skipFixedThisMonth(f.id)}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionBlock>
      )}

      {/* Card Charges */}
      {chargeGroups.length > 0 && (
        <SectionBlock title="Card Charges" subtotal={totals.ch} accent>
          <table className="w-full">
            <thead>
              <tr className="label-mono">
                <th className="w-[28px] px-4 py-2"></th>
                <th className="px-4 py-2 text-left font-normal">Card</th>
                <th className="px-4 py-2 text-left font-normal">Charges</th>
                <th className="px-4 py-2 text-right font-normal">Total</th>
                <th className="w-[110px] px-4 py-2 text-right font-normal">Status</th>
                {interactive && <th className="w-[80px] px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {chargeGroups.map((g) => {
                const isOpen = expanded[g.card.id];
                return (
                  <Fragment key={g.card.id}>
                    <tr
                      className="h-12 cursor-pointer border-t border-border bg-secondary/30 hover:bg-secondary/50"
                      onClick={() => setExpanded((s) => ({ ...s, [g.card.id]: !s[g.card.id] }))}
                    >
                      <td className="px-4">
                        {isOpen ? <ChevronDown className="h-4 w-4" strokeWidth={1.5} /> : <ChevronRight className="h-4 w-4" strokeWidth={1.5} />}
                      </td>
                      <td className="px-4 text-[13px]">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.card.color }} />
                          {g.card.name}
                        </span>
                      </td>
                      <td className="num px-4 text-[12px] text-muted-foreground">
                        {g.list.length} {g.list.length === 1 ? "charge" : "charges"}
                      </td>
                      <td className="num px-4 text-right text-[13px] font-medium">{formatMoney(g.subtotal)}</td>
                      <td className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <PaidStatus
                          paid={g.isCardPaid}
                          interactive={interactive}
                          onChange={(v) => setCardGroupPaid(g.card.id, v)}
                          disabled={true}
                        />
                      </td>
                      {interactive && <td></td>}
                    </tr>
                    {isOpen && g.list.map((c) => {
                      const isEditing = edit?.kind === "charge" && edit.id === c.id;
                      const cat = cats.find((x) => x.id === c.category_id);
                      if (isEditing) {
                        return (
                          <tr key={c.id} className="border-t border-border/60 bg-accent/30">
                            <td></td>
                            <td className="px-4 py-2" colSpan={2}>
                              <div className="flex gap-2">
                                <Input value={edit.description}
                                  onChange={(ev) => setEdit({ ...edit, description: ev.target.value })}
                                  className="h-8 text-[12.5px]" />
                                <div className="w-44">
                                  <CategorySelect cats={cats} value={edit.category_id}
                                    onChange={(v) => setEdit({ ...edit, category_id: v })} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Input value={edit.amount} inputMode="decimal"
                                onChange={(ev) => setEdit({ ...edit, amount: ev.target.value })}
                                className="num h-8 text-right text-[12.5px]" />
                            </td>
                            <td></td>
                            <td className="px-2 text-right">
                              <EditActions onSave={saveChargeEdit} onCancel={() => setEdit(null)} />
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={c.id} className="group h-10 border-t border-border/60 bg-background/40">
                          <td></td>
                          <td className="px-4 text-[12px] text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                              <span className={cn(c.type === "recurring" && !c.active && "line-through")}>{c.description}</span>
                              {c.type === "installment" && (
                                <span className="num rounded bg-secondary px-1.5 py-0.5 text-[10px]">
                                  {c.currentInst}/{c.total_installments}
                                </span>
                              )}
                              {c.type === "recurring" && (
                                <span className="num rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                                  Recurring
                                </span>
                              )}
                              {c.type === "one-time" && (
                                <span className="num rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  One-time
                                </span>
                              )}
                              {cat && (
                                <span className="inline-flex items-center gap-1 text-[11px]">
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                  {cat.name}
                                </span>
                              )}
                            </span>
                          </td>
                          <td></td>
                          <td className="num px-4 text-right text-[12px]">{formatMoney(Number(c.monthly_amount))}</td>
                          <td className="px-4 text-right">
                            <PaidStatus
                              paid={isChargePaid(c.id)}
                              interactive={interactive}
                              onChange={(v) => setChargePaid(c.id, v)}
                              small
                              disabled={true}
                            />
                          </td>
                          {interactive && (
                            <td className="px-4 text-right">
                              <RowActions
                                onEdit={() => setEdit({
                                  kind: "charge", id: c.id,
                                  description: c.description, amount: String(c.monthly_amount),
                                  category_id: c.category_id ?? "",
                                })}
                                onDelete={() => deleteCharge(c.id)}
                              />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </SectionBlock>
      )}

      {/* Grand total */}
      <div className="flex items-center justify-between rounded-md border border-border bg-surface px-5 py-4">
        <span className="label-mono">Grand Total</span>
        <span className="num text-[18px] tracking-[-0.02em]">{formatMoney(totals.grand)}</span>
      </div>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="label-mono mb-2">Description</div>
              <div className="text-[14px]">{payDialogFixedExpense?.description}</div>
            </div>
            <div>
              <div className="label-mono mb-2">Amount</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                <Input
                  className="num pl-6 text-[15px]"
                  placeholder="0.00"
                  value={payDialogAmount}
                  inputMode="decimal"
                  onChange={(e) => setPayDialogAmount(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={confirmPayFixedExpense}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editExpenseDialogOpen} onOpenChange={(open) => { if (!open) { setEditExpenseDialogOpen(false); setEditExpenseData(null); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          {editExpenseData && (
            <form onSubmit={(e) => { e.preventDefault(); saveExpenseEdit(); }} className="space-y-4">
              <div>
                <div className="label-mono mb-2">Amount</div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                  <Input className="num pl-6 text-[15px]" placeholder="0.00"
                    value={editExpenseData.amount} inputMode="decimal" autoFocus
                    onChange={(e) => setEditExpenseData({ ...editExpenseData, amount: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="label-mono mb-2">Category</div>
                  <Select value={editExpenseData.category_id} onValueChange={(v) => setEditExpenseData({ ...editExpenseData, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {cats.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="label-mono mb-2">Wallet</div>
                  <Select value={editExpenseData.wallet_account_id} onValueChange={(v) => setEditExpenseData({ ...editExpenseData, wallet_account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                    <SelectContent>
                      {wallets.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color }} />
                            {w.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <div className="label-mono mb-2">Description</div>
                <Input placeholder="Optional note" value={editExpenseData.description}
                  onChange={(e) => setEditExpenseData({ ...editExpenseData, description: e.target.value })} maxLength={200} />
              </div>
              <div>
                <div className="label-mono mb-2">Date</div>
                <Input type="date" value={editExpenseData.date}
                  onChange={(e) => setEditExpenseData({ ...editExpenseData, date: e.target.value })}
                  className="num text-[12px]" />
              </div>
              <div className="flex items-center justify-between">
                <div className="label-mono">Paid</div>
                <div className="flex items-center gap-2">
                  <Switch checked={editExpenseData.paid} onCheckedChange={(checked) => setEditExpenseData({ ...editExpenseData, paid: checked })} />
                  <span className={cn(
                    "num rounded px-1.5 py-0.5 text-[10px]",
                    editExpenseData.paid ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                  )}>
                    {editExpenseData.paid ? "Paid" : "Unpaid"}
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { setEditExpenseDialogOpen(false); setEditExpenseData(null); }}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionBlock({
  title, subtotal, children, accent = false,
}: { title: string; subtotal: number; children: React.ReactNode; accent?: boolean }) {
  return (
    <section className={cn(
      "overflow-hidden rounded-md border bg-surface",
      accent ? "border-primary/30" : "border-border"
    )}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="label-mono">{title}</div>
        <span className="num text-[13px] text-muted-foreground">{formatMoney(subtotal)}</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function CategoryCell({ cat }: { cat?: Category }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat?.color ?? "#8B867D" }} />
      {cat?.name ?? "Uncategorized"}
    </span>
  );
}

function CategorySelect({ cats, value, onChange }: { cats: Category[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Category" /></SelectTrigger>
      <SelectContent>
        {cats.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function WalletSelect({ wallets, value, onChange }: { wallets: Wallet[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Wallet" /></SelectTrigger>
      <SelectContent>
        {wallets.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color }} />
              {w.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100">
      <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7">
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7 hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
      </Button>
    </div>
  );
}

function EditActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={onSave} className="h-7 w-7 text-success">
        <Check className="h-4 w-4" strokeWidth={1.5} />
      </Button>
      <Button variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7">
        <X className="h-4 w-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
}

function PaidStatus({
  paid, interactive, onChange, small = false, disabled = false,
}: { paid: boolean; interactive: boolean; onChange: (v: boolean) => void; small?: boolean; disabled?: boolean }) {
  if (interactive) {
    return (
      <div className="inline-flex items-center gap-2">
        <Switch 
          checked={paid} 
          onCheckedChange={disabled ? undefined : onChange} 
          aria-label="Toggle paid"
          disabled={disabled}
        />
        <span className={cn(
          "num rounded px-1.5 py-0.5 text-[10px]",
          paid ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
        )}>
          {paid ? "Paid" : "Unpaid"}
        </span>
      </div>
    );
  }

  return (
    <span className={cn(
      "num inline-block rounded px-1.5 py-0.5",
      small ? "text-[10px]" : "text-[10px]",
      paid ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
    )}>
      {paid ? "Paid" : "Unpaid"}
    </span>
  );
}
