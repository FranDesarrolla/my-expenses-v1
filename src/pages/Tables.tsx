import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "categories" | "cards" | "wallets";

interface Row { id: string; name: string; color: string }

const TABS: { id: Tab; label: string; table: "categories" | "cards" | "wallet_accounts"; placeholder: string }[] = [
  { id: "categories", label: "Categories", table: "categories", placeholder: "Category name (e.g. Food)" },
  { id: "cards", label: "Cards", table: "cards", placeholder: "Card name (e.g. Chase Sapphire)" },
  { id: "wallets", label: "Wallets", table: "wallet_accounts", placeholder: "Account name (e.g. Mercado Pago)" },
];

export default function Tables() {
  const [tab, setTab] = useState<Tab>("categories");
  return (
    <AppLayout title="Manage" subtitle="Manage categories, cards and wallet accounts.">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[12.5px] transition-colors",
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "categories" && <AddButton table="categories" placeholder="Category name (e.g. Food)" />}
        {tab === "cards" && <AddButton table="cards" placeholder="Card name (e.g. Chase Sapphire)" />}
        {tab === "wallets" && <AddButton table="wallet_accounts" placeholder="Account name (e.g. Mercado Pago)" />}
      </div>
      {TABS.map((t) => tab === t.id && <CrudTable key={t.id} table={t.table} placeholder={t.placeholder} />)}
    </AppLayout>
  );
}

function AddButton({ table, placeholder }: { table: "categories" | "cards" | "wallet_accounts"; placeholder: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#D97757");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required.");
    const { error } = await supabase.from(table).insert({ name: name.trim(), color });
    if (error) return toast.error(error.message);
    setName("");
    setColor("#D97757");
    setAddOpen(false);
  }

  return (
    <Dialog open={addOpen} onOpenChange={setAddOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add {table === "categories" ? "Category" : table === "cards" ? "Card" : "Wallet"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={add} className="space-y-4">
          <div>
            <div className="label-mono mb-2">Name</div>
            <Input placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
          </div>
          <div>
            <div className="label-mono mb-2">Color</div>
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent" />
              <Input className="num flex-1" value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit">Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CrudTable({ table }: { table: "categories" | "cards" | "wallet_accounts" }) {
  const [items, setItems] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);

  useEffect(() => { void load(); }, [table]);

  async function load() {
    const { data } = await supabase.from(table).select("*").order("name");
    setItems((data ?? []) as Row[]);
  }

  async function remove(id: string) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase.from(table).update({ name: editing.name.trim(), color: editing.color }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    void load();
  }

return (
      <>
      <section className="rounded-md border border-border bg-surface overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="label-mono border-b border-border">
              <th className="w-12 px-5 py-3 text-left font-normal">Color</th>
              <th className="px-5 py-3 text-left font-normal">Name</th>
              <th className="px-5 py-3 text-left font-normal">Hex</th>
              <th className="w-24 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-[12px] text-muted-foreground">No records.</td></tr>
            ) : items.map((c) => {
              const isEdit = editing?.id === c.id;
              return (
                <tr key={c.id} className="group h-12 border-b border-border last:border-0 hover:bg-accent/40">
                  <td className="px-5">
                    {isEdit ? (
                      <input type="color" value={editing!.color} onChange={(e) => setEditing({ ...editing!, color: e.target.value })}
                        className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent" />
                    ) : (
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                    )}
                  </td>
                  <td className="px-5 text-[13px]">
                    {isEdit ? (
                      <Input value={editing!.name} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} className="h-8" />
                    ) : c.name}
                  </td>
                  <td className="num px-5 text-[12px] text-muted-foreground">
                    {isEdit ? (
                      <Input value={editing!.color} onChange={(e) => setEditing({ ...editing!, color: e.target.value })} className="num h-8 w-28" maxLength={7} />
                    ) : c.color.toUpperCase()}
                  </td>
                  <td className="px-5 text-right">
                    {isEdit ? (
                      <div className="flex justify-end gap-1">
                        <button onClick={saveEdit} className="text-success hover:opacity-80"><Check className="h-4 w-4" strokeWidth={1.5} /></button>
                        <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" strokeWidth={1.5} /></button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                        <button onClick={() => setEditing({ id: c.id, name: c.name, color: c.color })} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                        <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
