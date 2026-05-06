import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { MonthSelector } from "@/components/MonthSelector";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { OverviewCalendar } from "@/components/OverviewCalendar";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Wallet,
  CreditCard,
  Receipt,
  CalendarDays,
  DollarSign,
  PiggyBank,
} from "lucide-react";
import {
  startOfMonth,
  startOfMonthISO,
  endOfMonthISO,
  addMonths,
  monthShort,
  formatMoney,
} from "@/lib/format";
import { endOfMonth, format as formatDate } from "date-fns";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Expense {
  id: string;
  amount: number;
  category_id: string | null;
  date: string;
  paid: boolean;
}

interface FixedExpense {
  id: string;
  amount: number;
  category_id: string | null;
  description: string;
  start_date: string;
  end_date: string | null;
}

interface FixedPayment {
  fixed_expense_id: string;
  month: string;
  paid: boolean;
  paid_at: string | null;
  amount?: number;
}

interface CardPayment {
  id: string;
  card_id: string;
  month: string;
  amount: number;
}

interface Charge {
  id: string;
  description: string;
  card_id: string;
  monthly_amount: number;
  category_id: string | null;
  type: string;
  current_installment: number;
  total_installments: number;
  start_date: string;
  end_date: string | null;
  active?: boolean;
}

interface Card {
  id: string;
  name: string;
  color: string;
}

interface ExpensePayment {
  expense_id: string;
  paid: boolean;
}

export default function Dashboard() {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [view, setView] = useState<"dashboard" | "overview">("overview");
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fixed, setFixed] = useState<FixedExpense[]>([]);
  const [fixedPays, setFixedPays] = useState<FixedPayment[]>([]);
  const [salaryAmt, setSalaryAmt] = useState(0);
  const [extraIncomeAmt, setExtraIncomeAmt] = useState(0);
  const [sixMonths, setSixMonths] = useState<{ label: string; spent: number; current: boolean }[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [cardPays, setCardPays] = useState<CardPayment[]>([]);

  const [expensePayments, setExpensePayments] = useState<ExpensePayment[]>([]);

  useEffect(() => {
    void loadAll();
  }, [month]);

  async function loadAll() {
    const monthISO = formatDate(month, 'yyyy-MM-01');
    const start = monthISO;
    const end = endOfMonthISO(month);

const [
      cats,
      exps,
      sal,
      cds,
      chs,
      cp,
      fxs,
      fxPays,
      extra,
      expPays,
    ] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("expenses").select("id, amount, description, date, category_id, wallet_account_id").gte("date", start).lte("date", end),
      supabase.from("salary").select("wallet_account_id, amount, month").eq("month", start),
      supabase.from("cards").select("*"),
      supabase.from("card_charges").select("*"),
      (supabase.from("card_payments" as any).select("id, card_id, month, amount") as any),
      supabase.from("fixed_expenses").select("*").lte("start_date", end).or("end_date.is.null,end_date.gte." + start),
      supabase.from("fixed_expense_payments").select("fixed_expense_id, month, paid, paid_at, amount").eq("month", start),
      supabase.from("extra_income" as never).select("wallet_account_id, amount, date, concept").gte("date", start).lte("date", end),
      (supabase.from("expense_payments" as any).select("expense_id, paid") as any),
    ]);

    setCategories(cats.data ?? []);
    setExpenses((exps.data ?? []) as Expense[]);
    setSalaryAmt(((sal.data ?? []) as { amount: number }[]).reduce((s, r) => s + Number(r.amount), 0));
    setCards(cds.data ?? []);
    setCharges((chs.data ?? []) as Charge[]);
    setCardPays((cp.data ?? []) as CardPayment[]);
    setFixed((fxs.data ?? []) as FixedExpense[]);
    setFixedPays((fxPays.data ?? []) as FixedPayment[]);
    setExtraIncomeAmt(((extra.data ?? []) as { amount: number }[]).reduce((s, r) => s + Number(r.amount), 0));

    setExpensePayments((expPays.data ?? []) as ExpensePayment[]);

    const sixMonthsStart = addMonths(startOfMonth(month), -5);
    const sixMonthsEnd = endOfMonth(month);
    const sixStartStr = startOfMonthISO(sixMonthsStart);
    const sixEndStr = endOfMonthISO(month);

const [sixExpData, sixExpPaysData, sixFixedPaysData, sixCardPaysData] = await Promise.all([
      supabase.from("expenses").select("id, amount, date").gte("date", sixStartStr).lte("date", sixEndStr),
      (supabase.from("expense_payments" as any).select("expense_id, paid, paid_at").gte("paid_at", sixStartStr).lte("paid_at", sixEndStr) as any),
      (supabase.from("fixed_expense_payments" as any).select("fixed_expense_id, month, paid, amount").gte("month", sixStartStr).lte("month", sixEndStr) as any),
      (supabase.from("card_payments" as any).select("card_id, month, amount").gte("month", sixStartStr).lte("month", sixEndStr) as any),
    ]);

    const allExpenses = sixExpData.data ?? [];
    const allExpPays = (sixExpPaysData.data ?? []) as { expense_id: string; paid: boolean }[];
    const allFixedPays = (sixFixedPaysData.data ?? []) as { fixed_expense_id: string; month: string; paid: boolean; amount?: number }[];
    const allCardPays = (sixCardPaysData.data ?? []) as { card_id: string; month: string; amount: number }[];

    const fixedList = (fxs.data ?? []) as FixedExpense[];
    const allCharges = (chs.data ?? []) as Charge[];

    const months: { label: string; spent: number; current: boolean }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = addMonths(month, -i);
      const ms = startOfMonthISO(m);
      const me = endOfMonthISO(m);

      const monthExpIds = allExpenses.filter(e => e.date >= ms && e.date <= me).map(e => e.id);
      const paidExpIds = new Set(allExpPays.filter(p => p.paid && monthExpIds.includes(p.expense_id)).map(p => p.expense_id));
      const expTotal = allExpenses
        .filter(e => paidExpIds.has(e.id))
        .reduce((s, r) => s + Number(r.amount), 0);

      const monthFixedPays = allFixedPays.filter(p => p.month === ms && p.paid);
      const activeFixedForMonth = fixedList.filter(f => f.start_date <= me && (!f.end_date || f.end_date >= ms));
      const fixedSum = activeFixedForMonth.reduce((s, f) => {
        const payment = monthFixedPays.find(p => p.fixed_expense_id === f.id);
        return s + (payment ? (payment.amount ?? Number(f.amount)) : 0);
      }, 0);

const monthCardPays = allCardPays.filter(p => p.month === ms);
      const chargesSum = monthCardPays.reduce((s, p) => s + Number(p.amount), 0);

      months.push({ label: monthShort(m), spent: expTotal + fixedSum + chargesSum, current: i === 0 });
    }
    setSixMonths(months);
  }

  const activeCharges = useMemo(() => computeActiveCharges(charges, month), [charges, month]);
  const monthISO = formatDate(month, 'yyyy-MM-01');

  const fixedTotal = fixed.reduce((s, f) => s + Number(f.amount), 0);
  const chargesTotal = activeCharges.reduce((s, c) => s + Number(c.monthly_amount), 0);

  const isFixedPaid = (id: string) => fixedPays.find((p) => p.fixed_expense_id === id)?.paid ?? false;
  const getFixedAmount = (f: FixedExpense) => {
    const payment = fixedPays.find(p => p.fixed_expense_id === f.id);
    return payment?.amount ?? f.amount;
  };
  const isChargePaid = (id: string) => {
    const charge = charges.find((c) => c.id === id);
    if (!charge) return false;
    return cardPays.some((p) => p.card_id === charge.card_id && p.month === monthISO);
  };
  const isExpensePaid = (id: string) => expensePayments.find((p) => p.expense_id === id && p.paid)?.paid ?? false;

  const paidExpenses = expenses.filter((e) => isExpensePaid(e.id)).reduce((s, e) => s + Number(e.amount), 0);
  const paidFixed = fixed.filter((f) => isFixedPaid(f.id)).reduce((s, f) => s + Number(getFixedAmount(f)), 0);
  const paidCharges = cardPays
    .filter((p) => p.month === monthISO)
    .reduce((s, p) => s + Number(p.amount), 0);
  const spent = paidExpenses + paidFixed + paidCharges;

  const paidCardIds = new Set(cardPays.filter((p) => p.month === monthISO).map((p) => p.card_id));
  const unpaidExpenses = expenses.filter((e) => !isExpensePaid(e.id)).reduce((s, e) => s + Number(e.amount), 0);
  const unpaidFixed = fixed.filter((f) => !isFixedPaid(f.id)).reduce((s, f) => s + Number(getFixedAmount(f)), 0);
  const unpaidCharges = activeCharges
    .filter((c) => !paidCardIds.has(c.card_id))
    .reduce((s, c) => s + Number(c.monthly_amount), 0);
  const committed = unpaidExpenses + unpaidFixed + unpaidCharges;

  const totalIncome = salaryAmt + extraIncomeAmt;
  const available = totalIncome - spent;

  const paidCardsMap = useMemo(() => {
    const map = new Map<string, { amount: number; categoryId: string | null }>();
    cardPays
      .filter((p) => p.month === monthISO)
      .forEach((p) => {
        const cardCharges = activeCharges.filter((c) => c.card_id === p.card_id);
        const categoryId = cardCharges[0]?.category_id ?? null;
        const existing = map.get(p.card_id);
        if (existing) {
          existing.amount += Number(p.amount);
        } else {
          map.set(p.card_id, { amount: Number(p.amount), categoryId });
        }
      });
    return map;
  }, [cardPays, activeCharges, monthISO]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    const add = (catId: string | null, amt: number) => {
      const k = catId ?? "uncat";
      map.set(k, (map.get(k) ?? 0) + amt);
    };
    expenses.filter((e) => isExpensePaid(e.id)).forEach((e) => add(e.category_id, Number(e.amount)));
    fixed.filter((f) => isFixedPaid(f.id)).forEach((f) => add(f.category_id, Number(getFixedAmount(f))));
    paidCardsMap.forEach(({ amount, categoryId }) => {
      add(categoryId, amount);
    });
    return Array.from(map.entries())
      .map(([id, value]) => {
        const c = categories.find((c) => c.id === id);
        return { name: c?.name ?? "Uncategorized", value, color: c?.color ?? "#8B867D" };
      })
      .sort((a, b) => b.value - a.value);
  }, [expenses, fixed, categories, fixedPays, expensePayments, paidCardsMap]);

  const topCats = byCategory.slice(0, 5);
  const totalForPct = byCategory.reduce((s, x) => s + x.value, 0) || 1;

  const incomeVsSpentChart = useMemo(() => {
    if (totalIncome === 0) return [];
    const remaining = Math.max(0, totalIncome - spent);
    return [
      { name: "Spent", value: spent, color: "#ef4444" },
      { name: "Remaining", value: remaining, color: "#22c55e" },
    ];
  }, [totalIncome, spent]);

  const dailySpending = useMemo(() => {
    const dayMap: Record<number, number> = {};
    expenses.filter((e) => isExpensePaid(e.id)).forEach((e) => {
      const day = new Date(e.date + "T00:00:00").getDate();
      dayMap[day] = (dayMap[day] || 0) + Number(e.amount);
    });
    fixed.filter((f) => isFixedPaid(f.id)).forEach((f) => {
      const payment = fixedPays.find(p => p.fixed_expense_id === f.id);
      if (payment?.paid_at) {
        const day = new Date(payment.paid_at + "T00:00:00").getDate();
        dayMap[day] = (dayMap[day] || 0) + Number(payment.amount ?? Number(f.amount));
      }
    });
    cardPays.filter((p) => p.month === monthISO).forEach((p) => {
      const day = new Date(p.month + "-15").getDate();
      dayMap[day] = (dayMap[day] || 0) + Number(p.amount);
    });
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      amount: dayMap[i + 1] || 0,
    }));
  }, [expenses, fixed, fixedPays, cardPays, monthISO, month]);

  return (
    <AppLayout
      title="Home"
      subtitle="Command your cashflow."
      actions={<MonthSelector value={month} onChange={setMonth} />}
    >
      <div className="mb-6 inline-flex rounded-full border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setView("overview")}
          className={cn(
            "rounded-full px-4 py-1.5 text-[12.5px] transition-colors",
            view === "overview"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className={cn(
            "rounded-full px-4 py-1.5 text-[12.5px] transition-colors",
            view === "dashboard"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Dashboard
        </button>
      </div>

      {view === "dashboard" ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard label="Monthly Salary" value={salaryAmt} />
            <SummaryCard
              label="Extra Income"
              value={extraIncomeAmt}
              tone={extraIncomeAmt > 0 ? "positive" : "default"}
              formula="Non-salary earnings"
            />
            <SummaryCard
              label="Total Income"
              value={totalIncome}
              tone="positive"
              formula="Salary + Extra"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Spent"
              value={spent}
              tone={spent > totalIncome && totalIncome > 0 ? "negative" : "default"}
              formula="Paid expenses + fixed + charges"
            />
            <SummaryCard
              label="Committed"
              value={committed}
              tone={committed > 0 ? "negative" : "default"}
              formula="Pending to pay"
            />
            <SummaryCard
              label="Available Balance"
              value={available}
              tone={available < 0 ? "negative" : "positive"}
              formula="Income − Spent"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
            <Panel className="lg:col-span-4 flex flex-col">
              <PanelHeader title="Expenses by Category" />
              {byCategory.length === 0 ? (
                <Empty>No expenses recorded for this period.</Empty>
              ) : (
                <>
                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={byCategory}
                          dataKey="value"
                          innerRadius={55}
                          outerRadius={85}
                          stroke="hsl(var(--surface))"
                          strokeWidth={2}
                        >
                          {byCategory.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {byCategory.map((d) => (
                      <li key={d.name} className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: d.color }}
                          />
                          {d.name}
                        </span>
                        <span className="num text-muted-foreground">
                          {((d.value / totalForPct) * 100).toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>

            <Panel className="lg:col-span-8 flex flex-col">
              <PanelHeader title="Last 6 Months" />
              <div className="flex-1 min-h-[268px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sixMonths} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "Geist Mono" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "Geist Mono" }}
                      tickFormatter={(v) => `$${Math.round(v)}`}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--accent))" }}
                      contentStyle={{
                        backgroundColor: '#1a1a1a',
                        color: '#ffffff',
                        border: '1px solid #333333'
                      }}
                      labelStyle={{ color: '#ffffff' }}
                      itemStyle={{ color: '#ffffff' }}
                      formatter={(v: number) => formatMoney(v)}
                    />
                    <Bar dataKey="spent" radius={[3, 3, 0, 0]}>
                      {sixMonths.map((m, i) => (
                        <Cell key={i} fill={m.current ? "hsl(var(--primary))" : "hsl(var(--border))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel className="flex flex-col">
              <PanelHeader title="Income vs Spent" />
              {totalIncome === 0 ? (
                <Empty>No income data</Empty>
              ) : (
                <>
                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={incomeVsSpentChart}
                          dataKey="value"
                          innerRadius={55}
                          outerRadius={85}
                          stroke="hsl(var(--surface))"
                          strokeWidth={2}
                        >
                          {incomeVsSpentChart.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1a1a1a',
                            color: '#ffffff',
                            border: '1px solid #333333'
                          }}
                          labelStyle={{ color: '#ffffff' }}
                          itemStyle={{ color: '#ffffff' }}
                          formatter={(v: number) => formatMoney(v)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {incomeVsSpentChart.map((d) => (
                      <li key={d.name} className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                          {d.name}
                        </span>
                        <span className="num text-muted-foreground">
                          {((d.value / totalIncome) * 100).toFixed(1)}%
                        </span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between text-[12px] pt-2 border-t border-border">
                      <span className="flex items-center gap-2">Income Limit</span>
                      <span className="num text-foreground">{formatMoney(totalIncome)}</span>
                    </li>
                  </ul>
                </>
              )}
            </Panel>

            <Panel className="flex flex-col">
              <PanelHeader title="Daily Spending" />
              <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySpending} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "Geist Mono" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10, fontFamily: "Geist Mono" }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--accent))" }}
                      contentStyle={{
                        backgroundColor: '#1a1a1a',
                        color: '#ffffff',
                        border: '1px solid #333333'
                      }}
                      formatter={(v: number) => formatMoney(v)}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="mt-6">
            <Panel>
              <PanelHeader title="Top Categories" />
              {topCats.length === 0 ? (
                <Empty>—</Empty>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="label-mono">
                      <th className="text-left font-normal">#</th>
                      <th className="text-left font-normal">Category</th>
                      <th className="text-right font-normal">Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCats.map((c, i) => (
                      <tr key={c.name} className="h-9 border-t border-border">
                        <td className="num text-[12px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</td>
                        <td className="text-[13px]">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </span>
                        </td>
                        <td className="num text-right text-[13px]">{formatMoney(c.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <span className="hidden">{fixedTotal}{chargesTotal}</span>
        </>
      ) : view === "overview" ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <QuickAccessCard
              icon={Receipt}
              label="Expenses"
              onClick={() => navigate("/expenses")}
            />
            <QuickAccessCard
              icon={CalendarDays}
              label="Fixed Expenses"
              onClick={() => navigate("/fixed")}
            />
            <QuickAccessCard
              icon={CreditCard}
              label="Cards"
              onClick={() => navigate("/cards/add")}
            />
            <QuickAccessCard
              icon={DollarSign}
              label="Salary"
              onClick={() => navigate("/salary")}
            />
            <QuickAccessCard
              icon={PiggyBank}
              label="Extra Income"
              onClick={() => navigate("/extra-income")}
            />
            <QuickAccessCard
              icon={Wallet}
              label="Wallets"
              onClick={() => navigate("/wallet")}
            />
          </div>
          <div className="mt-6">
            <OverviewCalendar month={month} />
          </div>
        </>
      ) : view === "overview" ? (
        <></>
      ) : null}
    </AppLayout>
  );
}

function computeActiveCharges(charges: Charge[], month: Date): Charge[] {
  return charges.filter((c) => {
    if (c.type === "one-time") {
      const d = new Date(c.start_date);
      return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
    }
    const start = new Date(c.start_date);
    const monthsSinceStart =
      (month.getFullYear() - start.getFullYear()) * 12 + (month.getMonth() - start.getMonth());
    if (monthsSinceStart < 0) return false;
    if (c.type === "recurring") {
      if (!c.end_date) return true;
      const end = new Date(c.end_date);
      const monthsUntilEnd =
        (end.getFullYear() - month.getFullYear()) * 12 + (end.getMonth() - month.getMonth());
      return monthsUntilEnd >= 0;
    }
    return monthsSinceStart >= 0 && monthsSinceStart < c.total_installments;
  });
}

function SummaryCard({
  label,
  value,
  tone = "default",
  formula,
}: {
  label: string;
  value: number;
  tone?: "default" | "positive" | "negative";
  formula?: string;
}) {
  const color =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <div className="label-mono">{label}</div>
      <div className={`mt-2 text-[28px] leading-none tracking-[-0.04em] ${color}`}>
        $<AnimatedNumber value={value} />
      </div>
      {formula && (
        <div className="num mt-2 text-[10px] text-muted-foreground">{formula}</div>
      )}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-border bg-surface p-5 ${className}`}>
      {children}
    </section>
  );
}

function PanelHeader({ title }: { title: string }) {
  return <div className="label-mono mb-4">{title}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-32 items-center justify-center text-[12px] text-muted-foreground">
      {children}
    </div>
  );
}

function QuickAccessCard({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-md border border-border bg-surface p-4 transition-colors hover:bg-secondary hover:border-muted-foreground"
    >
      <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </button>
  );
}
