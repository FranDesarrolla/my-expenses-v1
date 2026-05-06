import * as React from "react";
import { ChevronLeft, ChevronRight, Trash2, Plus, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { format } from "date-fns";
import { startOfMonthISO, endOfMonthISO, formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  color: string;
  dismissed: boolean;
}

interface OverviewCalendarProps {
  month: Date;
}

interface Category { id: string; name: string; color: string }
interface Wallet { id: string; name: string; color: string }
interface Card { id: string; name: string; color: string }
interface FixedExpense { id: string; description: string; wallet_account_id: string | null }

interface CalendarItem {
  type: "salary" | "extra_income" | "expense" | "fixed" | "card";
  name: string;
  wallet: string;
  amount: number;
}

interface Transfer {
  id: string;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  amount: number;
  date: string;
  notes: string | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OverviewCalendar({ month }: OverviewCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(month);
  const [incomeData, setIncomeData] = React.useState<{ date: string; items: CalendarItem[] }[]>([]);
  const [expenseData, setExpenseData] = React.useState<{ date: string; items: CalendarItem[] }[]>([]);
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [transfers, setTransfers] = React.useState<Transfer[]>([]);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [addingReminder, setAddingReminder] = React.useState(false);
  const [newReminder, setNewReminder] = React.useState({
    title: "",
    description: "",
    all_day: true,
    start_time: "",
    end_time: "",
    color: "#3b82f6",
  });

  React.useEffect(() => {
    setCurrentMonth(month);
  }, [month]);

  React.useEffect(() => {
    void loadData();
  }, [currentMonth]);

  async function loadData() {
    const start = startOfMonthISO(currentMonth);
    const end = endOfMonthISO(currentMonth);

    const [
      salaryData,
      extraIncomeData,
      expensesData,
      expensePaymentsData,
      fixedPaymentsData,
      fixedExpensesData,
      cardPaymentsData,
      categoriesData,
      walletsData,
      cardsData,
      remindersData,
      transfersData,
    ] = await Promise.all([
      supabase.from("salary").select("month, amount, wallet_account_id"),
      supabase.from("extra_income" as any).select("date, amount, concept, wallet_account_id"),
      supabase.from("expenses").select("id, amount, date, category_id, wallet_account_id"),
      (supabase.from("expense_payments" as any).select("expense_id, paid, paid_at") as any),
      (supabase.from("fixed_expense_payments" as any).select("fixed_expense_id, paid, paid_at, amount") as any),
      supabase.from("fixed_expenses").select("id, description, wallet_account_id, amount"),
      (supabase.from("card_payments" as any).select("card_id, wallet_account_id, amount, date") as any),
      supabase.from("categories").select("id, name"),
      supabase.from("wallet_accounts").select("id, name"),
      supabase.from("cards").select("id, name"),
      (supabase.from("reminders" as any).select("*") as any),
      supabase.from("wallet_transfers").select("*"),
    ]);

    setTransfers((transfersData.data ?? []) as Transfer[]);
    setWallets((walletsData.data ?? []) as Wallet[]);

    setReminders(remindersData.data ?? []);

    const categories = (categoriesData.data ?? []) as Category[];
    const wallets = (walletsData.data ?? []) as Wallet[];
    const cards = (cardsData.data ?? []) as Card[];
    const fixedExpenses = (fixedExpensesData.data ?? []) as FixedExpense[];

    const getWalletName = (id: string | null) => wallets.find(w => w.id === id)?.name ?? "—";
    const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? "Uncategorized";
    const getCardName = (id: string | null) => cards.find(c => c.id === id)?.name ?? "—";

    const incomeMap: Record<string, CalendarItem[]> = {};
    const expenseMap: Record<string, CalendarItem[]> = {};

    // Salary - use month field (yyyy-MM-01)
    (salaryData.data ?? []).forEach((s: { month: string; amount: number; wallet_account_id: string | null }) => {
      const date = s.month; // month is already yyyy-MM-01 format
      if (!incomeMap[date]) incomeMap[date] = [];
      incomeMap[date].push({
        type: "salary",
        name: "Salary",
        wallet: getWalletName(s.wallet_account_id),
        amount: Number(s.amount),
      });
    });

    // Extra Income
    (extraIncomeData.data ?? []).forEach((e: { date: string; amount: number; concept: string; wallet_account_id: string | null }) => {
      const date = e.date.slice(0, 10);
      if (!incomeMap[date]) incomeMap[date] = [];
      incomeMap[date].push({
        type: "extra_income",
        name: e.concept || "Extra Income",
        wallet: getWalletName(e.wallet_account_id),
        amount: Number(e.amount),
      });
    });

    // Build expense payment lookup: expense_id -> {paid, paid_at}
    const expensePaymentMap: Record<string, { paid: boolean; paid_at: string | null }> = {};
    (expensePaymentsData.data ?? []).forEach((p: { expense_id: string; paid: boolean; paid_at: string | null }) => {
      expensePaymentMap[p.expense_id] = { paid: p.paid, paid_at: p.paid_at };
    });

    // Expenses with paid check - only show if paid = true and paid_at is not null
    (expensesData.data ?? []).forEach((e: { id: string; amount: number; date: string; category_id: string | null; wallet_account_id: string | null }) => {
      const payment = expensePaymentMap[e.id];
      if (payment?.paid && payment.paid_at) {
        const date = payment.paid_at.slice(0, 10);
        if (!expenseMap[date]) expenseMap[date] = [];
        expenseMap[date].push({
          type: "expense",
          name: getCategoryName(e.category_id),
          wallet: getWalletName(e.wallet_account_id),
          amount: Number(e.amount),
        });
      }
    });

    // Fixed expense payments with paid_at
    (fixedPaymentsData.data ?? []).forEach((p: { fixed_expense_id: string; paid: boolean; paid_at: string | null; amount: number | null }) => {
      if (p.paid && p.paid_at) {
        const date = p.paid_at.slice(0, 10);
        const fixedExpense = fixedExpenses.find(f => f.id === p.fixed_expense_id);
        if (!expenseMap[date]) expenseMap[date] = [];
        expenseMap[date].push({
          type: "fixed",
          name: fixedExpense?.description ?? "Fixed Expense",
          wallet: getWalletName(fixedExpense?.wallet_account_id ?? null),
          amount: Number(p.amount ?? fixedExpense?.amount ?? 0),
        });
      }
    });

    // Card payments
    (cardPaymentsData.data ?? []).forEach((cp: { card_id: string; wallet_account_id: string | null; amount: number; date: string }) => {
      const date = cp.date.slice(0, 10);
      if (!expenseMap[date]) expenseMap[date] = [];
      expenseMap[date].push({
        type: "card",
        name: getCardName(cp.card_id),
        wallet: getWalletName(cp.wallet_account_id),
        amount: Number(cp.amount),
      });
    });

    // Convert maps to arrays
    const incomeArray = Object.entries(incomeMap).map(([date, items]) => ({ date, items }));
    const expenseArray = Object.entries(expenseMap).map(([date, items]) => ({ date, items }));

    setIncomeData(incomeArray);
    setExpenseData(expenseArray);
  }

  const goToPreviousMonth = () => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    setCurrentMonth(prev);
  };

  const goToNextMonth = () => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentMonth(next);
  };

  const days = React.useMemo(() => {
    const year = currentMonth.getFullYear();
    const monthIndex = currentMonth.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const daysArray: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) {
      daysArray.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      daysArray.push(new Date(year, monthIndex, i));
    }
    while (daysArray.length % 7 !== 0) {
      daysArray.push(null);
    }

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < daysArray.length; i += 7) {
      weeks.push(daysArray.slice(i, i + 7));
    }
    return weeks;
  }, [currentMonth]);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const getDayItems = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const incomes = incomeData.find(d => d.date === dateStr)?.items ?? [];
    const expenses = expenseData.find(d => d.date === dateStr)?.items ?? [];
    const dayReminders = reminders.filter(r => r.date === dateStr && !r.dismissed);
    return { incomes, expenses, reminders: dayReminders };
  };

  const getRemindersForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return reminders.filter(r => r.date === dateStr && !r.dismissed);
  };

  const getTransfersForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return transfers.filter(t => t.date === dateStr);
  };

  const walletName = (id: string | null) => wallets.find(w => w.id === id)?.name ?? "—";

  const COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#a855f7", "#ec4899"];

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminder.title.trim() || !selectedDate) return;

    const { error } = await (supabase.from("reminders" as any).insert({
      title: newReminder.title.trim(),
      description: newReminder.description.trim() || null,
      date: format(selectedDate, "yyyy-MM-dd"),
      start_time: newReminder.all_day ? null : (newReminder.start_time || null),
      end_time: newReminder.all_day ? null : (newReminder.end_time || null),
      all_day: newReminder.all_day,
      color: newReminder.color,
      dismissed: false,
    }) as any);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Reminder added");
      setNewReminder({ title: "", description: "", all_day: true, start_time: "", end_time: "", color: "#3b82f6" });
      setAddingReminder(false);
      void loadData();
    }
  };

  const handleDeleteReminder = async (id: string) => {
    const { error } = await (supabase.from("reminders" as any).delete().eq("id", id) as any);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Reminder deleted");
      void loadData();
    }
  };

  return (
    <div className="w-full rounded-md border border-border bg-surface p-6">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-[14px] font-medium">
          {format(currentMonth, "MMMM yyyy")}
        </div>
        <button
          type="button"
          onClick={goToNextMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="w-full">
        <div className="grid grid-cols-7 w-full gap-1">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="h-8 text-[12px] font-normal text-muted-foreground flex items-center justify-center"
            >
              {day}
            </div>
          ))}
        </div>
        {days.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 w-full gap-1 mt-1">
            {week.map((day, dayIndex) => {
              if (!day) {
                return <div key={dayIndex} className="h-[80px] w-full" />;
              }
              const dayItems = getDayItems(day);
              const hasIncome = dayItems.incomes.length > 0;
              const hasExpense = dayItems.expenses.length > 0;
              const dayReminders = getRemindersForDate(day);
              const hasReminders = dayReminders.length > 0;
              const dayTransfers = getTransfersForDate(day);
              const hasTransfer = dayTransfers.length > 0;
              const hasDots = hasIncome || hasExpense || hasReminders || hasTransfer;

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    "h-[80px] w-full p-1 flex flex-col items-start justify-start rounded-md text-[14px]",
                    hasDots ? "cursor-pointer hover:bg-secondary/50" : "cursor-pointer hover:bg-secondary/30"
                  )}
                >
                  <div
                    className="w-full h-full flex flex-col"
                    onClick={() => setSelectedDate(day)}
                  >
                    <span className={cn(isToday(day) && "font-bold bg-accent px-1.5 py-0.5 rounded")}>
                      {format(day, "d")}
                    </span>
                    <div className="flex flex-col gap-0.5 mt-1">
                      {hasIncome && (
                        <span className="text-[8px] font-medium px-1 py-0.5 rounded bg-success/20 text-success text-center">Income</span>
                      )}
                      {hasExpense && (
                        <span className="text-[8px] font-medium px-1 py-0.5 rounded bg-destructive/20 text-destructive text-center">Expense</span>
                      )}
                      {dayReminders.map((r, i) => (
                        <span key={i} className="text-[8px] font-medium px-1 py-0.5 rounded text-center" style={{ backgroundColor: `${r.color}20`, color: r.color }}>
                          Reminder
                        </span>
                      ))}
                      {hasTransfer && (
                        <span className="text-[8px] font-medium px-1 py-0.5 rounded bg-primary/20 text-primary text-center">Transfer</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <Dialog open={!!selectedDate} onOpenChange={() => { setSelectedDate(null); setAddingReminder(false); }}>
        <DialogContent className="w-[95vw] max-w-[480px] max-h-[80vh] overflow-y-auto [&_[data-radix-dialog-close]]:!top-2">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>{selectedDate && format(selectedDate, "MMMM d, yyyy")}</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setAddingReminder(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-1">REMINDERS</div>
              {selectedDate && getDayItems(selectedDate).reminders.length > 0 ? (
                <div className="space-y-2">
                  {getDayItems(selectedDate).reminders.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-[11px]">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                      <span className="flex-1 truncate text-foreground">{r.title}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {r.all_day ? "All day" : r.start_time && r.end_time ? `${r.start_time}-${r.end_time}` : r.start_time || ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteReminder(r.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground">No reminders</div>
              )}
            </div>

            {selectedDate && getDayItems(selectedDate).incomes.length > 0 && (
              <div>
                <div className="text-[10px] font-medium text-success mb-1">INCOMES</div>
                {getDayItems(selectedDate).incomes.map((item, i) => (
                  <div key={i} className="text-[11px] flex justify-between">
                    <span className="text-muted-foreground">{item.name} ({item.wallet})</span>
                    <span className="num text-foreground">{formatMoney(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedDate && getDayItems(selectedDate).expenses.length > 0 && (
              <div>
                <div className="text-[10px] font-medium text-destructive mb-1">EXPENSES</div>
                {getDayItems(selectedDate).expenses.map((item, i) => (
                  <div key={i} className="text-[11px] flex justify-between">
                    <span className="text-muted-foreground">{item.name} ({item.wallet})</span>
                    <span className="num text-foreground">{formatMoney(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedDate && getTransfersForDate(selectedDate).length > 0 && (
              <div>
                <div className="text-[10px] font-medium text-primary mb-1">TRANSFERS</div>
                {getTransfersForDate(selectedDate).map((t) => (
                  <div key={t.id} className="text-[11px] flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      {walletName(t.from_wallet_id)}
                      <ArrowRight className="h-3 w-3" />
                      {walletName(t.to_wallet_id)}
                      {t.notes && <span className="text-[10px] ml-1">({t.notes})</span>}
                    </span>
                    <span className="num text-foreground">{formatMoney(Number(t.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addingReminder} onOpenChange={(open) => { if (!open) { setAddingReminder(false); setNewReminder({ title: "", description: "", all_day: true, start_time: "", end_time: "", color: "#3b82f6" }); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Reminder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddReminder} className="space-y-3">
            <Input
              placeholder="Title"
              value={newReminder.title}
              onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
              required
            />
            <Textarea
              placeholder="Description (optional)"
              value={newReminder.description}
              onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
              rows={2}
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={newReminder.all_day}
                onCheckedChange={(checked) => setNewReminder({ ...newReminder, all_day: checked })}
              />
              <span className="text-[12px] text-muted-foreground">All day</span>
            </div>
            {!newReminder.all_day && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">Start</label>
                  <Input
                    type="time"
                    value={newReminder.start_time}
                    onChange={(e) => setNewReminder({ ...newReminder, start_time: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground">End</label>
                  <Input
                    type="time"
                    value={newReminder.end_time}
                    onChange={(e) => setNewReminder({ ...newReminder, end_time: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div>
              <div className="text-[10px] text-muted-foreground mb-1">Color</div>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewReminder({ ...newReminder, color: c })}
                    className={cn(
                      "h-6 w-6 rounded-full border-2",
                      newReminder.color === c ? "border-foreground" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => { setAddingReminder(false); setNewReminder({ title: "", description: "", all_day: true, start_time: "", end_time: "", color: "#3b82f6" }); }}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}