import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Card { id: string; name: string; color: string }

export default function MyCards() {
  const [cards, setCards] = useState<Card[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#D97757");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eColor, setEColor] = useState("#D97757");

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data } = await supabase.from("cards").select("*").order("name");
    setCards(data ?? []);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Card name required.");
    const { error } = await supabase.from("cards").insert({ name: name.trim(), color });
    if (error) return toast.error(error.message);
    setName("");
    toast.success("Card added.");
    void load();
  }

  function startEdit(c: Card) {
    setEditingId(c.id);
    setEName(c.name);
    setEColor(c.color);
  }

  async function saveEdit(id: string) {
    if (!eName.trim()) return toast.error("Card name required.");
    const { error } = await supabase.from("cards").update({ name: eName.trim(), color: eColor }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditingId(null);
    void load();
  }

  async function del(id: string) {
    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  return (
    <AppLayout title="My Cards" subtitle="Create, edit and delete your payment cards.">
      <section className="mb-6 rounded-md border border-border bg-surface p-5">
        <div className="label-mono mb-4">Add Card</div>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input placeholder="Card name (e.g. Chase Sapphire)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
            />
            <Input className="num w-28" value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} />
          </div>
          <Button type="submit" size="icon"><Plus className="h-4 w-4" strokeWidth={1.5} /></Button>
        </form>
      </section>

      <section className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-5 py-3">
          <div className="label-mono">Cards</div>
        </div>
        {cards.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-muted-foreground">No cards yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="label-mono">
                <th className="px-5 py-3 text-left font-normal">Color</th>
                <th className="px-5 py-3 text-left font-normal">Name</th>
                <th className="w-[120px] px-5 py-3 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} className="h-12 border-t border-border">
                  <td className="px-5">
                    {editingId === c.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={eColor}
                          onChange={(e) => setEColor(e.target.value)}
                          className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent"
                        />
                        <Input className="num h-7 w-24 text-[12px]" value={eColor} onChange={(e) => setEColor(e.target.value)} maxLength={7} />
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="num text-[11px] text-muted-foreground">{c.color}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-5 text-[13px] max-w-[150px] truncate">
                    {editingId === c.id ? (
                      <Input className="h-7 text-[13px]" value={eName} onChange={(e) => setEName(e.target.value)} maxLength={60} />
                    ) : (
                      c.name
                    )}
                  </td>
                  <td className="px-5">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === c.id ? (
                        <>
                          <button onClick={() => saveEdit(c.id)} className="rounded p-1.5 text-success hover:bg-secondary" aria-label="Save">
                            <Check className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Cancel">
                            <X className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(c)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit">
                            <Pencil className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                          <button onClick={() => del(c.id)} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive" aria-label="Delete">
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </AppLayout>
  );
}
