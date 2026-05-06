import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { MonthSelector } from "@/components/MonthSelector";
import { MonthlyExpensesList } from "@/components/MonthlyExpensesList";
import { startOfMonth } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface Category { id: string; name: string; color: string }
interface Wallet { id: string; name: string; color: string }

export default function MyExpenses() {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);
  const [open, setOpen] = useState(false);

  // Modal form state
  const [cats, setCats] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("wallet_accounts").select("*").order("name"),
    ]).then(([c, w]) => {
      setCats((c.data ?? []) as Category[]);
      setWallets((w.data ?? []) as Wallet[]);
      if (c.data && c.data.length > 0 && !categoryId) setCategoryId(c.data[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount.");
    if (!categoryId) return toast.error("Pick a category.");
    const { data: expense, error } = await supabase.from("expenses").insert({
      amount: amt,
      category_id: categoryId,
      wallet_account_id: walletId || null,
      description: description.trim() || null,
      date,
    }).select().single();
    if (error) return toast.error(error.message);
    
    if (paid && expense) {
      const today = format(new Date(), "yyyy-MM-dd");
      await supabase.from("expense_payments" as any).insert({
        expense_id: expense.id,
        amount: amt,
        wallet_account_id: walletId || null,
        date: today,
        paid: true,
        paid_at: today,
      } as any);
    }
    
    toast.success("Expense recorded.");
    setAmount("");
    setDescription("");
    setPaid(false);
    setOpen(false);
    setRefreshKey((k) => k + 1);
  }

  return (
    <AppLayout
      title="Expenses"
      actions={
        <div className="flex items-center gap-2">
          <MonthSelector value={month} onChange={setMonth} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
                <span className="hidden md:inline">Add Expense</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>New Expense</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <div className="label-mono mb-2">Amount</div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                    <Input className="num pl-6 text-[15px]" placeholder="0.00"
                      value={amount} inputMode="decimal" autoFocus
                      onChange={(e) => setAmount(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="label-mono mb-2">Category</div>
                    <Select value={categoryId} onValueChange={setCategoryId}>
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
                    <Select value={walletId} onValueChange={setWalletId}>
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
                  <Input placeholder="Optional note" value={description}
                    onChange={(e) => setDescription(e.target.value)} maxLength={200} />
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
                <div className="flex items-center justify-between">
                  <div className="label-mono">Paid</div>
                  <div className="flex items-center gap-2">
                    <Switch checked={paid} onCheckedChange={setPaid} />
                    <span className={cn(
                      "num rounded px-1.5 py-0.5 text-[10px]",
                      paid ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                    )}>
                      {paid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Record Expense</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <MonthlyExpensesList month={month} interactive refreshKey={refreshKey} />
    </AppLayout>
  );
}
