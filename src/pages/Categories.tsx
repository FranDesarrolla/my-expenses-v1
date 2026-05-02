import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Category { id: string; name: string; color: string }

export default function Categories() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#D97757");
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data } = await supabase.from("categories").select("*").order("name");
    setItems(data ?? []);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required.");
    const { error } = await supabase.from("categories").insert({ name: name.trim(), color });
    if (error) return toast.error(error.message);
    setName("");
    void load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase.from("categories").update({ name: editing.name.trim(), color: editing.color }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    void load();
  }

  return (
    <AppLayout title="Tables" subtitle="Manage categories used across the ledger.">
      <section className="mb-6 rounded-md border border-border bg-surface p-5">
        <div className="label-mono mb-4">New Category</div>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input placeholder="Category name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent" />
            <Input className="num w-28" value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} />
          </div>
          <Button type="submit" size="icon"><Plus className="h-4 w-4" strokeWidth={1.5} /></Button>
        </form>
      </section>

      <section className="rounded-md border border-border bg-surface">
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
              <tr><td colSpan={4} className="px-5 py-10 text-center text-[12px] text-muted-foreground">No categories.</td></tr>
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
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100">
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
    </AppLayout>
  );
}
