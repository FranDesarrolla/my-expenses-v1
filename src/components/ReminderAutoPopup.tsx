import * as React from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

export function ReminderAutoPopup() {
  const [open, setOpen] = React.useState(false);
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (loaded) return;

    const loadReminders = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await (supabase
        .from("reminders" as any)
        .select("*")
        .lte("date", today)
        .eq("dismissed", false)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true }) as any);

      const result = (data ?? []) as Reminder[];
      if (result.length > 0) {
        setReminders(result);
        setOpen(true);
      }
      setLoaded(true);
    };

    void loadReminders();
  }, [loaded]);

  const handleDismiss = async (id: string) => {
    const { error } = await (supabase
      .from("reminders" as any)
      .update({ dismissed: true })
      .eq("id", id) as any);

    if (error) {
      toast.error(error.message);
    } else {
      const updated = reminders.filter((r) => r.id !== id);
      setReminders(updated);
      if (updated.length === 0) {
        setOpen(false);
      }
      window.dispatchEvent(new Event("reminder-dismissed"));
    }
  };

  const handleDismissAll = async () => {
    const ids = reminders.map((r) => r.id);
    const { error } = await (supabase
      .from("reminders" as any)
      .update({ dismissed: true })
      .in("id", ids) as any);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("All reminders dismissed");
      setOpen(false);
      window.dispatchEvent(new Event("reminder-dismissed"));
    }
  };

  const groupedByDate = React.useMemo(() => {
    const groups: Record<string, Reminder[]> = {};
    reminders.forEach((r) => {
      if (!groups[r.date]) {
        groups[r.date] = [];
      }
      groups[r.date].push(r);
    });
    return groups;
  }, [reminders]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {reminders.length === 1
              ? "You have a reminder"
              : `You have ${reminders.length} reminders`}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[300px] overflow-y-auto space-y-4 py-2">
          {Object.entries(groupedByDate).map(([date, items]) => (
            <div key={date}>
              <div className="text-[10px] font-medium text-muted-foreground mb-2">
                {format(parseISO(date), "MMMM d, yyyy")}
              </div>
              <div className="space-y-2">
                {items.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-2 rounded-md border border-border p-2"
                  >
                    <span
                      className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate">{r.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.all_day
                          ? "All day"
                          : r.start_time && r.end_time
                            ? `${r.start_time} - ${r.end_time}`
                            : r.start_time || ""}
                      </div>
                      {r.description && (
                        <div className="mt-1 text-[10px] text-muted-foreground line-clamp-2">
                          {r.description}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDismiss(r.id)}
                      className="flex-shrink-0 text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          {reminders.length > 1 && (
            <Button type="button" onClick={handleDismissAll}>
              Dismiss all
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}