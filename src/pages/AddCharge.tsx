import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Pencil, Trash2, Plus, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { MonthSelector } from "@/components/MonthSelector";
import { startOfMonth, formatMoney } from "@/lib/format";
import { toast } from "sonner";

type ChargeType = "one-time" | "installment" | "recurring";

interface Card { id: string; name: string; color: string }
interface Category { id: string; name: string; color: string }
interface Wallet { id: string; name: string; color: string }
interface Charge {
  id: string; description: string; card_id: string; category_id: string | null;
  type: ChargeType; monthly_amount: number;
  total_installments: number; current_installment: number; start_date: string; charge_date: string;
  active: boolean;
}

interface CardPayment {
  id: string;
  card_id: string;
  month: string;
  amount: number;
  wallet_account_id: string | null;
  date: string;
  notes: string | null;
  created_at: string;
}

export default function AddCharge() {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [cards, setCards] = useState<Card[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPayment[]>([]);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  const toggleCard = (cardId: string) => {
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  // Form state
  const [cDesc, setCDesc] = useState("");
  const [cCard, setCCard] = useState("");
  const [cCat, setCCat] = useState("");
  const [cType, setCType] = useState<ChargeType>("one-time");
  const [cAmount, setCAmount] = useState("");
  const [cInstall, setCInstall] = useState("1");
  const [cDate, setCDate] = useState<Date>(new Date());

  // Card payment dialog state
  const [payCardOpen, setPayCardOpen] = useState(false);
  const [payingCardId, setPayingCardId] = useState<string | null>(null);
  const [payingWalletId, setPayingWalletId] = useState<string>("");
  const [payingAmount, setPayingAmount] = useState("");
  const [payingNotes, setPayingNotes] = useState("");
  const [payingDate, setPayingDate] = useState<Date>(new Date());

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Charge | null>(null);

  useEffect(() => { void loadAll(); }, [month]);

  async function loadAll() {
    const monthStr = format(month, "yyyy-MM-01");
    const [a, b, c, w, cp] = await Promise.all([
      supabase.from("cards").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("card_charges").select("*").order("created_at", { ascending: false }),
      supabase.from("wallet_accounts").select("*").order("name"),
      (supabase.from("card_payments" as any).select("*").eq("month", monthStr) as any),
    ]);
    setCards(a.data ?? []);
    setCats(b.data ?? []);
    setCharges((c.data ?? []) as Charge[]);
    setWallets(w.data ?? []);
    setCardPayments(cp.data ?? []);
    if (a.data?.length && !cCard) setCCard(a.data[0].id);
    if (b.data?.length && !cCat) setCCat(b.data[0].id);
    if (w.data?.length && !payingWalletId) setPayingWalletId(w.data[0].id);
  }

  async function addCharge(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(cAmount);
    if (!cDesc.trim() || !amt || amt <= 0 || !cCard) return toast.error("Fill all required fields.");
    const installments = cType === "installment" ? Math.max(1, parseInt(cInstall) || 1) : 1;
    const payload = {
      description: cDesc.trim(),
      card_id: cCard,
      category_id: cCat || null,
      type: cType,
      monthly_amount: amt,
      total_installments: installments,
      current_installment: 1,
      start_date: format(cDate, "yyyy-MM-dd"),
      charge_date: format(cDate, "yyyy-MM-dd"),
      active: true,
    };
    const { error } = await supabase.from("card_charges").insert(payload);
    if (error) return toast.error(error.message);
    setCDesc(""); setCAmount(""); setCInstall("1");
    setAddOpen(false);
    toast.success("Charge added.");
    void loadAll();
  }

  async function delCharge(id: string) {
    const { error } = await supabase.from("card_charges").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void loadAll();
  }

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("card_charges").update({ active }).eq("id", id);
    if (error) return toast.error(error.message);
    setCharges((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)));
  }

  async function saveEdit() {
    if (!editing) return;
    const amt = Number(editing.monthly_amount);
    if (!editing.description.trim() || !amt || amt <= 0) return toast.error("Fill all required fields.");
    const installments =
      editing.type === "installment" ? Math.max(1, Number(editing.total_installments) || 1) : 1;
    const { error } = await supabase
      .from("card_charges")
      .update({
        description: editing.description.trim(),
        card_id: editing.card_id,
        category_id: editing.category_id,
        type: editing.type,
        monthly_amount: amt,
        total_installments: installments,
        start_date: editing.start_date,
        charge_date: editing.start_date,
        active: editing.active,
      })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    toast.success("Charge updated.");
    void loadAll();
  }

  // Open pay card dialog with pre-filled amount
  function openPayCard(cardId: string) {
    const cardCharges = monthCharges.filter(c => c.card_id === cardId);
    const pendingAmount = cardCharges.reduce((sum, c) => sum + Number(c.monthly_amount), 0);
    setPayingCardId(cardId);
    setPayingAmount(pendingAmount > 0 ? String(pendingAmount) : "");
    setPayingNotes("");
    setPayingDate(new Date());
    // Reset wallet to first available
    if (wallets.length > 0) {
      setPayingWalletId(wallets[0].id);
    }
    setPayCardOpen(true);
  }

  async function saveCardPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingCardId || !payingWalletId) return;
    const amt = parseFloat(payingAmount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount.");
    
    const monthStr = format(month, "yyyy-MM-01");
    const { error } = await supabase.from("card_payments" as any).insert({
      card_id: payingCardId,
      month: monthStr,
      amount: amt,
      wallet_account_id: payingWalletId,
      date: format(payingDate, "yyyy-MM-dd"),
      notes: payingNotes.trim() || null,
    } as any);
    
    if (error) return toast.error(error.message);
    
    // Mark all charge_payments for this card and month as paid
    const cardChargeIds = monthCharges.filter(c => c.card_id === payingCardId).map(c => c.id);
    if (cardChargeIds.length > 0) {
      // Check which charge_payments exist for this month
      const { data: existingPayments } = await supabase
        .from("charge_payments")
        .select("id, charge_id")
        .eq("month", monthStr)
        .in("charge_id", cardChargeIds);
      
      if (existingPayments && existingPayments.length > 0) {
        // Update existing charge_payments to paid
        await supabase
          .from("charge_payments")
          .update({ paid: true })
          .eq("month", monthStr)
          .in("charge_id", cardChargeIds);
      } else {
        // Create charge_payments records for each charge
        const newPayments = cardChargeIds.map(chargeId => ({
          charge_id: chargeId,
          month: monthStr,
          paid: true,
        }));
        await supabase.from("charge_payments").insert(newPayments);
      }
    }
    
    toast.success("Payment recorded.");
    setPayCardOpen(false);
    void loadAll();
  }

  async function delCardPayment(id: string) {
    const payment = cardPayments.find(p => p.id === id);
    if (!payment) return;
    
    const { error } = await supabase.from("card_payments" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    
    // Unmark all charge_payments for this card and month
    const cardChargeIds = monthCharges.filter(c => c.card_id === payment.card_id).map(c => c.id);
    if (cardChargeIds.length > 0) {
      await supabase
        .from("charge_payments")
        .update({ paid: false })
        .eq("month", payment.month)
        .in("charge_id", cardChargeIds);
    }
    
    toast.success("Payment deleted.");
    void loadAll();
  }

  // Filter charges active in selected month + compute installment progress
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
          inMonth = monthsSinceStart >= 0;
        }
        const currentInst =
          c.type === "installment" ? Math.min(c.total_installments, monthsSinceStart + 1) : 1;
        return { ...c, _inMonth: inMonth, currentInst };
      })
      .filter((c) => c._inMonth);
  }, [charges, month]);

  const filteredMonthCharges = useMemo(() => {
    if (selectedCards.size === 0) return monthCharges;
    return monthCharges.filter((c) => selectedCards.has(c.card_id));
  }, [monthCharges, selectedCards]);

  // Get unique cards with pending amounts for the month
  const cardsWithPending = useMemo(() => {
    const cardMap = new Map<string, { card: Card; pending: number }>();
    monthCharges.forEach(c => {
      const card = cards.find(k => k.id === c.card_id);
      if (card) {
        const existing = cardMap.get(card.id) || { card, pending: 0 };
        existing.pending += Number(c.monthly_amount);
        cardMap.set(card.id, existing);
      }
    });
    return Array.from(cardMap.values());
  }, [monthCharges, cards]);

  const typeLabel = (t: ChargeType) =>
    t === "one-time" ? "One-time" : t === "installment" ? "Installment" : "Recurring";

  return (
    <AppLayout
      title="Cards"
      subtitle="Manage your cards and track charges."
      actions={
        <div className="flex items-center gap-2">
          <MonthSelector value={month} onChange={setMonth} />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
                Add Charge
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>New Charge</DialogTitle>
              </DialogHeader>
              <form onSubmit={addCharge} className="space-y-4">
                <div>
                  <div className="label-mono mb-2">Description</div>
                  <Input placeholder="e.g. Netflix" value={cDesc} onChange={(e) => setCDesc(e.target.value)} maxLength={100} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="label-mono mb-2">Card</div>
                    <Select value={cCard} onValueChange={setCCard}>
                      <SelectTrigger><SelectValue placeholder="Card" /></SelectTrigger>
                      <SelectContent>
                        {cards.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="label-mono mb-2">Category</div>
                    <Select value={cCat} onValueChange={setCCat}>
                      <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                      <SelectContent>
                        {cats.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <div className="label-mono mb-2">Type</div>
                  <div className="inline-flex rounded-md border border-border p-0.5">
                    {(["one-time", "installment", "recurring"] as ChargeType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCType(t)}
                        className={cn(
                          "rounded px-3 py-1 text-[12px] capitalize",
                          cType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                        )}
                      >
                        {t === "one-time" ? "One-time" : t === "installment" ? "Installments" : "Recurring"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="label-mono mb-2">Monthly Amount</div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                      <Input className="num pl-6" placeholder="0.00" value={cAmount} onChange={(e) => setCAmount(e.target.value)} inputMode="decimal" />
                    </div>
                  </div>
                  <div>
                    <div className="label-mono mb-2">Installments</div>
                    <Input
                      className="num"
                      type="number"
                      min={1}
                      value={cInstall}
                      onChange={(e) => setCInstall(e.target.value)}
                      disabled={cType !== "installment"}
                    />
                  </div>
                  <div>
                    <div className="label-mono mb-2">Start Date</div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="num w-full justify-start text-[12px] font-normal">
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />
                          {format(cDate, "MMM dd")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar mode="single" selected={cDate} onSelect={(d) => d && setCDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                {cType === "recurring" && (
                  <div className="text-[11px] text-muted-foreground">
                    Recurring charges repeat every month from the start date until you deactivate them.
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button type="submit">Add Charge</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {/* Cards with pending amounts */}
      {cardsWithPending.length > 0 && (
        <section className="mb-6 rounded-md border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="label-mono">Cards With Pending Charges</div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {cardsWithPending.map(({ card, pending }) => {
              const monthStr = format(month, "yyyy-MM-01");
              const hasPayment = cardPayments.some(cp => cp.card_id === card.id && cp.month === monthStr);
              const isSelected = selectedCards.has(card.id);
              return (
                <div
                  key={card.id}
                  className={cn(
                    "flex items-center justify-between rounded-md border border-border bg-background p-3 cursor-pointer transition-colors",
                    isSelected && "ring-2 ring-offset-1"
                  )}
                  style={isSelected ? { ringColor: card.color } : undefined}
                  onClick={() => toggleCard(card.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: card.color }} />
                    <span className="text-[13px]">{card.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="num text-[13px] font-medium">{formatMoney(pending)}</span>
                    {hasPayment ? (
                      <span className="num rounded bg-success/15 px-2 py-1 text-[10px] font-medium text-success">
                        Paid
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-[11px]" onClick={(e) => { e.stopPropagation(); openPayCard(card.id); }}>
                        <CreditCard className="h-3 w-3" />
                        Pay
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Charges this month */}
      <section className="rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="label-mono">Charges This Month</div>
        </div>

        {filteredMonthCharges.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-muted-foreground">
            {selectedCards.size > 0 ? "No charges for selected cards." : "No charges this month."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="label-mono">
                  <th className="px-5 py-3 text-left font-normal">Description</th>
                  <th className="px-5 py-3 text-left font-normal">Card</th>
                  <th className="px-5 py-3 text-left font-normal">Type</th>
                  <th className="px-5 py-3 text-left font-normal">Progress</th>
                  <th className="px-5 py-3 text-left font-normal">Active</th>
                  <th className="px-5 py-3 text-right font-normal">Amount</th>
                  <th className="w-[100px] px-5 py-3 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthCharges.map((c) => {
                  const card = cards.find((k) => k.id === c.card_id);
                  return (
                    <tr key={c.id} className="h-12 border-t border-border">
                      <td className={cn("px-5 text-[13px]", c.type === "recurring" && !c.active && "text-muted-foreground line-through")}>
                        {c.description}
                      </td>
                      <td className="px-5 text-[13px]">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: card?.color ?? "#888" }} />
                          {card?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-5">
                        <span
                          className={cn(
                            "num rounded px-1.5 py-0.5 text-[10px]",
                            c.type === "recurring" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                          )}
                        >
                          {typeLabel(c.type)}
                        </span>
                      </td>
                      <td className="num px-5 text-[12px] text-muted-foreground">
                        {c.type === "installment" ? `${c.currentInst}/${c.total_installments}` : "—"}
                      </td>
                      <td className="px-5">
                        {c.type === "recurring" ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={c.active}
                              onCheckedChange={(v) => toggleActive(c.id, !!v)}
                              aria-label="Toggle active"
                            />
                            <span
                              className={cn(
                                "num rounded px-1.5 py-0.5 text-[10px]",
                                c.active ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                              )}
                            >
                              {c.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="num px-5 text-right text-[13px]">{formatMoney(Number(c.monthly_amount))}</td>
                      <td className="px-5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing(c)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => delCharge(c.id)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Payment History */}
      <section className="mt-6 rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="label-mono">Payment History</div>
        </div>
        {cardPayments.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-muted-foreground">No payments this month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="label-mono">
                  <th className="px-5 py-3 text-left font-normal">Card</th>
                  <th className="px-5 py-3 text-left font-normal">Wallet</th>
                  <th className="px-5 py-3 text-left font-normal">Date</th>
                  <th className="px-5 py-3 text-left font-normal">Notes</th>
                  <th className="px-5 py-3 text-right font-normal">Amount</th>
                  <th className="w-[80px] px-5 py-3 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cardPayments.map((p) => {
                  const card = cards.find(c => c.id === p.card_id);
                  const wallet = wallets.find(w => w.id === p.wallet_account_id);
                  return (
                    <tr key={p.id} className="h-11 border-t border-border">
                      <td className="px-5 text-[13px]">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: card?.color ?? "#888" }} />
                          {card?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 text-[13px]">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: wallet?.color ?? "#888" }} />
                          {wallet?.name ?? "—"}
                        </span>
                      </td>
                      <td className="num px-5 text-[12px] text-muted-foreground">
                        {new Date(p.date).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 text-[12px] text-muted-foreground">{p.notes ?? "—"}</td>
                      <td className="num px-5 text-right text-[13px]">{formatMoney(Number(p.amount))}</td>
                      <td className="px-5 text-right">
                        <button
                          onClick={() => delCardPayment(p.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                          aria-label="Delete payment"
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

      {/* Pay Card Dialog */}
      <Dialog open={payCardOpen} onOpenChange={setPayCardOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Pay Card</DialogTitle>
          </DialogHeader>
          {payingCardId && (
            <form onSubmit={saveCardPayment} className="space-y-4">
              <div className="rounded-md bg-secondary p-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cards.find(c => c.id === payingCardId)?.color ?? "#888" }} />
                  <span className="text-[13px] font-medium">{cards.find(c => c.id === payingCardId)?.name ?? "—"}</span>
                </div>
                <div className="num mt-1 text-[12px] text-muted-foreground">
                  Pending: {formatMoney(cardsWithPending.find(c => c.card.id === payingCardId)?.pending ?? 0)}
                </div>
              </div>
              <div>
                <div className="label-mono mb-2">Wallet</div>
                <Select value={payingWalletId} onValueChange={setPayingWalletId}>
                  <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
                  <SelectContent>
                    {wallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.color }} />{w.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="label-mono mb-2">Amount</div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                  <Input className="num pl-6" placeholder="0.00" value={payingAmount} onChange={(e) => setPayingAmount(e.target.value)} inputMode="decimal" />
                </div>
              </div>
              <div>
                <div className="label-mono mb-2">Date</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="num w-full justify-start text-[12px] font-normal">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />
                      {format(payingDate, "MMM dd, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={payingDate} onSelect={(d) => d && setPayingDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <div className="label-mono mb-2">Notes (optional)</div>
                <Input placeholder="e.g. Full payment" value={payingNotes} onChange={(e) => setPayingNotes(e.target.value)} maxLength={200} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setPayCardOpen(false)}>Cancel</Button>
                <Button type="submit">Confirm Payment</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Charge</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-12">
                <div className="label-mono mb-1">Description</div>
                <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} maxLength={100} />
              </div>
              <div className="md:col-span-6">
                <div className="label-mono mb-1">Card</div>
                <Select value={editing.card_id} onValueChange={(v) => setEditing({ ...editing, card_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-6">
                <div className="label-mono mb-1">Category</div>
                <Select value={editing.category_id ?? ""} onValueChange={(v) => setEditing({ ...editing, category_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {cats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />{c.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-12">
                <div className="label-mono mb-1">Type</div>
                <div className="inline-flex rounded-md border border-border p-0.5">
                  {(["one-time", "installment", "recurring"] as ChargeType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditing({ ...editing, type: t })}
                      className={cn(
                        "rounded px-3 py-1 text-[12px] capitalize",
                        editing.type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      )}
                    >
                      {t === "one-time" ? "One-time" : t === "installment" ? "Installments" : "Recurring"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-4">
                <div className="label-mono mb-1">Amount</div>
                <Input
                  className="num"
                  inputMode="decimal"
                  value={String(editing.monthly_amount)}
                  onChange={(e) => setEditing({ ...editing, monthly_amount: Number(e.target.value) })}
                />
              </div>
              <div className="md:col-span-4">
                <div className="label-mono mb-1">Installments</div>
                <Input
                  className="num"
                  type="number"
                  min={1}
                  value={String(editing.total_installments)}
                  onChange={(e) => setEditing({ ...editing, total_installments: Number(e.target.value) })}
                  disabled={editing.type !== "installment"}
                />
              </div>
              <div className="md:col-span-4">
                <div className="label-mono mb-1">Start Date</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="num w-full justify-start text-[12px] font-normal">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />
                      {format(new Date(editing.start_date), "MMM dd, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={new Date(editing.start_date)}
                      onSelect={(d) => d && setEditing({ ...editing, start_date: format(d, "yyyy-MM-dd") })}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {editing.type === "recurring" && (
                <div className="md:col-span-12 flex items-center gap-3">
                  <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: !!v })} />
                  <span className="text-[12px] text-muted-foreground">{editing.active ? "Active" : "Inactive"}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}