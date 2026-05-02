import * as React from "react";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

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

export function ReminderBell() {
  const [count, setCount] = React.useState(0);
  const [reminders, setReminders] = React.useState<Reminder[]>([]);
  const [open, setOpen] = React.useState(false);

  const loadTodayReminders = React.useCallback(async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await (supabase
      .from("reminders" as any)
      .select("*")
      .eq("date", today)
      .eq("dismissed", false)
      .order("start_time", { ascending: true }) as any);

    const result = (data ?? []) as Reminder[];
    setReminders(result);
    setCount(result.length);
  }, []);

  React.useEffect(() => {
    void loadTodayReminders();
    const interval = setInterval(() => {
      void loadTodayReminders();
    }, 60000);

    const handleEvent = () => {
      void loadTodayReminders();
    };
    window.addEventListener("reminder-dismissed", handleEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener("reminder-dismissed", handleEvent);
    };
  }, [loadTodayReminders]);

  const handleDismiss = async (id: string) => {
    const { error } = await (supabase
      .from("reminders" as any)
      .update({ dismissed: true })
      .eq("id", id) as any);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Reminder dismissed");
      window.dispatchEvent(new Event("reminder-dismissed"));
      void loadTodayReminders();
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
      window.dispatchEvent(new Event("reminder-dismissed"));
      void loadTodayReminders();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface shadow-lg hover:bg-secondary"
        >
          <Bell className="h-5 w-5" strokeWidth={1.5} />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-[13px] font-medium">Today's Reminders</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {reminders.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-muted-foreground">
              No reminders for today
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map((r) => (
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
                      {r.all_day ? "All day" : r.start_time && r.end_time ? `${r.start_time} - ${r.end_time}` : r.start_time || ""}
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
          )}
        </div>
        {reminders.length > 1 && (
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-[11px]"
              onClick={handleDismissAll}
            >
              Dismiss all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}