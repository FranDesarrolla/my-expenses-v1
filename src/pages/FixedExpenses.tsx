import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pencil, Calendar as CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";

interface Category { id: string; name: string; color: string }
interface Wallet { id: string; name: string; color: string }
interface FixedExpense { id: string; description: string; amount: number; category_id: string | null; wallet_account_id: string | null; start_date: string; end_date: string | null }

export default function FixedExpenses() {
  const [items, setItems] = useState<FixedExpense[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<FixedExpense | null>(null);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [catId, setCatId] = useState<string>("");
  const [walletId, setWalletId] = useState<string>("");
  const [addStartDate, setAddStartDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [addEndDate, setAddEndDate] = useState("");
  const [addNoEndDate, setAddNoEndDate] = useState(true);
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCatId, setEditCatId] = useState<string>("");
  const [editWalletId, setEditWalletId] = useState<string>("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editNoEndDate, setEditNoEndDate] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    const [a, b, w] = await Promise.all([
      supabase.from("fixed_expenses").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
      supabase.from("wallet_accounts").select("*").order("name"),
    ]);
    setItems((a.data ?? []) as FixedExpense[]);
    setCats(b.data ?? []);
    setWallets((w.data ?? []) as Wallet[]);
    if (b.data?.length && !catId) setCatId(b.data[0].id);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!desc.trim() || !amt || amt <= 0 || !addStartDate) { toast.error("Description, amount, and start date required."); return; }
    const { error } = await supabase.from("fixed_expenses").insert({
      description: desc.trim(),
      amount: amt,
      category_id: catId || null,
      wallet_account_id: walletId || null,
      start_date: addStartDate,
      end_date: addNoEndDate ? null : (addEndDate || null),
    });
    if (error) return toast.error(error.message);
    setDesc(""); setAmount("");
    setOpen(false);
    toast.success("Fixed expense added.");
    void load();
  }

  async function remove(id: string) {
    await supabase.from("fixed_expense_payments").delete().eq("fixed_expense_id", id);
    const { error } = await supabase.from("fixed_expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  function openEdit(item: FixedExpense) {
    setEditItem(item);
    setEditDesc(item.description);
    setEditAmount(String(item.amount));
    setEditCatId(item.category_id ?? "");
    setEditWalletId(item.wallet_account_id ?? "");
    setEditStartDate(item.start_date);
    setEditEndDate(item.end_date ?? "");
    setEditNoEndDate(!item.end_date);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    const amt = parseFloat(editAmount);
    if (!editDesc.trim() || !amt || amt <= 0 || !editStartDate) {
      toast.error("Description, amount, and start date required.");
      return;
    }
    const { error } = await supabase.from("fixed_expenses").update({
      description: editDesc.trim(),
      amount: amt,
      category_id: editCatId || null,
      wallet_account_id: editWalletId || null,
      start_date: editStartDate,
      end_date: editNoEndDate ? null : (editEndDate || null),
    }).eq("id", editItem.id);
    if (error) return toast.error(error.message);
    setEditItem(null);
    toast.success("Fixed expense updated.");
    void load();
  }

  const total = items.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <AppLayout
      title="Fixed Expenses"
      subtitle="Recurring monthly bills."
      actions={
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
                Add Fixed Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>New Fixed Expense</DialogTitle>
              </DialogHeader>
              <form onSubmit={add} className="space-y-4">
                <div>
                  <div className="label-mono mb-2">Description</div>
                  <Input placeholder="e.g. Rent" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={100} autoFocus />
                </div>
                <div>
                  <div className="label-mono mb-2">Amount</div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                    <Input className="num pl-6 text-[15px]" placeholder="0.00" value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="label-mono mb-2">Category</div>
                    <Select value={catId} onValueChange={setCatId}>
                      <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="label-mono mb-2">Start Date</div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="num w-full justify-start text-[12px] font-normal">
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />
                          {format(parseISO(addStartDate), "MMM dd, yyyy")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parseISO(addStartDate)}
                          onSelect={(d) => d && setAddStartDate(format(d, "yyyy-MM-dd"))}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <div className="label-mono mb-2">End Date</div>
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild disabled={addNoEndDate}>
                          <Button type="button" variant="outline" className="num flex-1 justify-start text-[12px] font-normal">
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />
                            {addEndDate ? format(parseISO(addEndDate), "MMM dd, yyyy") : "Select"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={addEndDate ? parseISO(addEndDate) : undefined}
                            onSelect={(d) => { setAddEndDate(d ? format(d, "yyyy-MM-dd") : ""); setAddNoEndDate(false); }}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Switch checked={addNoEndDate} onCheckedChange={setAddNoEndDate} />
                      <span className="text-[11px] text-muted-foreground">No end date</span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit">Add Fixed Expense</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Fixed Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div>
              <div className="label-mono mb-2">Description</div>
              <Input placeholder="e.g. Rent" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={100} autoFocus />
            </div>
            <div>
              <div className="label-mono mb-2">Amount</div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
                <Input className="num pl-6 text-[15px]" placeholder="0.00" value={editAmount} inputMode="decimal" onChange={(e) => setEditAmount(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label-mono mb-2">Category</div>
                <Select value={editCatId} onValueChange={setEditCatId}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
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
                <Select value={editWalletId} onValueChange={setEditWalletId}>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label-mono mb-2">Start Date</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="num w-full justify-start text-[12px] font-normal">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />
                      {editStartDate ? format(parseISO(editStartDate), "MMM dd, yyyy") : "Select"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editStartDate ? parseISO(editStartDate) : undefined}
                      onSelect={(d) => d && setEditStartDate(format(d, "yyyy-MM-dd"))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <div className="label-mono mb-2">End Date</div>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild disabled={editNoEndDate}>
                      <Button type="button" variant="outline" className="num flex-1 justify-start text-[12px] font-normal">
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />
                        {editEndDate ? format(parseISO(editEndDate), "MMM dd, yyyy") : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editEndDate ? parseISO(editEndDate) : undefined}
                        onSelect={(d) => { setEditEndDate(d ? format(d, "yyyy-MM-dd") : ""); setEditNoEndDate(false); }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Switch checked={editNoEndDate} onCheckedChange={setEditNoEndDate} />
                  <span className="text-[11px] text-muted-foreground">No end date</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditItem(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
        </div>
      }
    >
      <div className="rounded-md border border-border bg-surface">
        <table className="w-full">
          <thead>
            <tr className="label-mono border-b border-border">
              <th className="px-5 py-3 text-left font-normal">Description</th>
              <th className="px-5 py-3 text-left font-normal">Category</th>
              <th className="px-5 py-3 text-right font-normal">Amount</th>
              <th className="w-20 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-[12px] text-muted-foreground">No fixed expenses recorded.</td></tr>
            ) : items.map((it) => {
              const c = cats.find((x) => x.id === it.category_id);
              return (
                <tr key={it.id} className="group h-10 border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-5 text-[13px]">{it.description}</td>
                  <td className="px-5 text-[13px]">
                    {c ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="num px-5 text-right text-[13px]">{formatMoney(Number(it.amount))}</td>
                  <td className="px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(it)} className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground">
                        <Pencil className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                      <button onClick={() => remove(it.id)} className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive">
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t border-border">
                <td colSpan={2} className="label-mono px-5 py-3">Monthly Total</td>
                <td className="num px-5 py-3 text-right text-[14px] font-medium">{formatMoney(total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </AppLayout>
  );
}
