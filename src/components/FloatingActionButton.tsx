import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Bell, Calculator as CalculatorIcon, X, DollarSign, RefreshCw, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

function ReminderAutoPopup() {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
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

    loadReminders();
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

  const groupedByDate = useMemo(() => {
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

function ReminderPopover() {
  const [count, setCount] = useState(0);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);

  const loadTodayReminders = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    supabase
      .from("reminders" as any)
      .select("*")
      .eq("date", today)
      .eq("dismissed", false)
      .order("start_time", { ascending: true })
      .then(({ data }) => {
        const result = (data ?? []) as Reminder[];
        setReminders(result);
        setCount(result.length);
      });
  };

  useEffect(() => {
    loadTodayReminders();
    const interval = setInterval(loadTodayReminders, 60000);
    const handleEvent = () => loadTodayReminders();
    window.addEventListener("reminder-dismissed", handleEvent);
    return () => {
      clearInterval(interval);
      window.removeEventListener("reminder-dismissed", handleEvent);
    };
  }, []);

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
      loadTodayReminders();
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
      loadTodayReminders();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface shadow-lg hover:bg-secondary"
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

function CalculatorPopover({ showTrigger = true }: { showTrigger?: boolean }) {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [previous, setPrevious] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);

  const calculate = (a: string, b: string, op: string): string => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    switch (op) {
      case "+": return String(numA + numB);
      case "-": return String(numA - numB);
      case "*": return String(numA * numB);
      case "/": return numB !== 0 ? String(numA / numB) : "Error";
      default: return b;
    }
  };

  const handleInput = (value: string) => {
    if (value === "C") {
      setDisplay("0");
      setPrevious(null);
      setOperator(null);
    } else if (value === "⌫") {
      setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
    } else if (["+", "-", "*", "/"].includes(value)) {
      setPrevious(display);
      setOperator(value);
      setDisplay("0");
    } else if (value === "=") {
      if (previous !== null && operator !== null) {
        const result = calculate(previous, display, operator);
        setDisplay(result);
        setPrevious(null);
        setOperator(null);
      }
    } else {
      setDisplay((prev) => (prev === "0" ? value : prev + value));
    }
  };

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key >= "0" && e.key <= "9") handleInput(e.key);
      if (e.key === ".") handleInput(".");
      if (e.key === "+") handleInput("+");
      if (e.key === "-") handleInput("-");
      if (e.key === "*") handleInput("*");
      if (e.key === "/") handleInput("/");
      if (e.key === "Enter" || e.key === "=") handleInput("=");
      if (e.key === "Backspace") handleInput("⌫");
      if (e.key === "c" || e.key === "C") handleInput("C");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const buttons = ["C", "⌫", "/", "*", "7", "8", "9", "-", "4", "5", "6", "+", "1", "2", "3", "=", "0", "."];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface shadow-lg hover:bg-secondary", !showTrigger && "hidden")}
        >
          <CalculatorIcon className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
        data-floating-calculator="true"
      >
        <div className="p-4" style={{ width: "320px" }}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">Calculator</span>
          </div>
          <div className="mb-3 rounded bg-background p-3 text-right">
            <div className="num text-[10px] text-muted-foreground">
              {previous} {operator}
            </div>
            <div className="num text-[28px] font-medium tracking-tight">
              {display}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {buttons.map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => handleInput(btn)}
                className={cn(
                  "flex h-14 items-center justify-center rounded text-[18px]",
                  btn === "=" && "col-span-1 bg-primary text-primary-foreground",
                  ["+", "-", "*", "/"].includes(btn) && "text-muted-foreground",
                  ["C", "⌫"].includes(btn) && "text-muted-foreground text-[16px]",
                  !["C", "⌫", "=", "+", "-", "*", "/"].includes(btn) && "text-foreground"
                )}
              >
                {btn}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DolarRate {
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

function ConverterPopover() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rates, setRates] = useState<DolarRate[]>([]);
  const [selectedType, setSelectedType] = useState("blue");
  const [fromCurrency, setFromCurrency] = useState<"ARS" | "USD">("ARS");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");

  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("https://dolarapi.com/v1/dolares");
      if (!response.ok) throw new Error("Could not fetch rates");
      const data = await response.json();
      console.log("Full dolarapi response:", data.map((d: DolarRate) => ({ casa: d.casa, nombre: d.nombre })));
      setRates(data);
    } catch (err) {
      setError("Could not fetch rates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && rates.length === 0) {
      fetchRates();
    }
  }, [open]);

  const casaMap: Record<string, string> = {
    blue: "blue",
    oficial: "oficial",
    mep: "bolsa",
    ccl: "contadoconliqui",
  };
  const currentRate = rates.find((r) => r.casa === casaMap[selectedType]);
  const rate = currentRate?.venta ?? 0;

  const handleFromChange = (value: string) => {
    setFromAmount(value);
    const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    if (!isNaN(num) && isFinite(num) && rate > 0) {
      if (fromCurrency === "ARS") {
        setToAmount((num / rate).toFixed(2));
      } else {
        setToAmount((num * rate).toFixed(2));
      }
    } else {
      setToAmount("");
    }
  };

  const handleFromCurrencyChange = (currency: "ARS" | "USD") => {
    setFromCurrency(currency);
    setFromAmount("");
    setToAmount("");
  };

  const toCurrency = fromCurrency === "ARS" ? "USD" : "ARS";

  const fromFlag = fromCurrency === "ARS" ? (
    <svg width="20" height="14" viewBox="0 0 20 14" className="shrink-0">
      <rect width="20" height="14" fill="#74ACDF"/>
      <rect y="4.67" width="20" height="4.67" fill="white"/>
      <circle cx="10" cy="7" r="1.5" fill="#F6B40E"/>
    </svg>
  ) : (
    <svg width="20" height="14" viewBox="0 0 20 14" className="shrink-0">
      <rect width="20" height="14" fill="#B22234"/>
      <rect y="2" width="20" height="1.08" fill="white"/>
      <rect y="4.15" width="20" height="1.08" fill="white"/>
      <rect y="6.31" width="20" height="1.08" fill="white"/>
      <rect y="8.46" width="20" height="1.08" fill="white"/>
      <rect y="10.62" width="20" height="1.08" fill="white"/>
      <rect y="12.77" width="20" height="1.08" fill="white"/>
      <rect width="8" height="7.5" fill="#3C3B6E"/>
    </svg>
  );

  const toFlag = toCurrency === "ARS" ? (
    <svg width="20" height="14" viewBox="0 0 20 14" className="shrink-0">
      <rect width="20" height="14" fill="#74ACDF"/>
      <rect y="4.67" width="20" height="4.67" fill="white"/>
      <circle cx="10" cy="7" r="1.5" fill="#F6B40E"/>
    </svg>
  ) : (
    <svg width="20" height="14" viewBox="0 0 20 14" className="shrink-0">
      <rect width="20" height="14" fill="#B22234"/>
      <rect y="2" width="20" height="1.08" fill="white"/>
      <rect y="4.15" width="20" height="1.08" fill="white"/>
      <rect y="6.31" width="20" height="1.08" fill="white"/>
      <rect y="8.46" width="20" height="1.08" fill="white"/>
      <rect y="10.62" width="20" height="1.08" fill="white"/>
      <rect y="12.77" width="20" height="1.08" fill="white"/>
      <rect width="8" height="7.5" fill="#3C3B6E"/>
    </svg>
  );

  const tabs = [
    { id: "blue", label: "Blue" },
    { id: "oficial", label: "Oficial" },
    { id: "mep", label: "MEP" },
    { id: "ccl", label: "CCL" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface shadow-lg hover:bg-secondary"
        >
          <DollarSign className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[12px] font-medium">Currency Converter</span>
            <button
              type="button"
              onClick={fetchRates}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>

          {error ? (
            <div className="text-center py-4">
              <div className="text-[12px] text-destructive mb-2">{error}</div>
              <Button type="button" size="sm" onClick={fetchRates}>Retry</Button>
            </div>
          ) : (
            <>
              {rate > 0 && (
                <div className="mb-4 text-center">
                  <span className="text-[11px] text-muted-foreground">
                    1 USD = ${rate.toLocaleString("es-AR")} ARS
                  </span>
                </div>
              )}

              <div className="mb-3 rounded-md border border-border bg-background p-3">
                <div className="text-[10px] text-muted-foreground mb-2">Amount</div>
                <div className="flex items-center gap-2">
                  {fromFlag}
                  <button
                    type="button"
                    onClick={() => handleFromCurrencyChange(fromCurrency === "ARS" ? "USD" : "ARS")}
                    className="flex items-center gap-1 text-[12px] text-foreground hover:text-primary transition-colors cursor-pointer"
                  >
                    <span>{fromCurrency}</span>
                    <span className="text-muted-foreground text-[10px]">↔</span>
                  </button>
                  <Input
                    value={fromAmount}
                    onChange={(e) => handleFromChange(e.target.value)}
                    placeholder="0.00"
                    className="num text-[15px] flex-1"
                  />
                </div>
              </div>

              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-[10px] text-muted-foreground mb-2">Converts to</div>
                <div className="flex items-center gap-2">
                  {toFlag}
                  <span className="text-[12px] text-muted-foreground">{toCurrency}</span>
                  <Input
                    value={toAmount}
                    placeholder="0.00"
                    readOnly
                    className="num text-[15px] flex-1 bg-muted/50"
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setSelectedType(tab.id);
                      if (fromAmount) {
                        const cleaned = fromAmount.replace(/[^\d.,]/g, "").replace(",", ".");
                        const num = parseFloat(cleaned);
                        const newRate = rates.find((r) => r.casa === casaMap[tab.id])?.venta ?? 0;
                        if (!isNaN(num) && newRate > 0) {
                          if (fromCurrency === "ARS") {
                            setToAmount((num / newRate).toFixed(2));
                          } else {
                            setToAmount((num * newRate).toFixed(2));
                          }
                        }
                      }
                    }}
                    className={cn(
                      "flex-1 rounded-full py-1.5 text-[11px] transition-colors",
                      selectedType === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface text-muted-foreground hover:text-foreground border border-border"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotesPopover() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [hasNotes, setHasNotes] = useState(false);

  const STORAGE_KEY = "quick-notes";

  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(STORAGE_KEY);
      setNotes(saved || "");
      setHasNotes(!!saved);
    }
  }, [open]);

  useEffect(() => {
    const checkNotes = () => setHasNotes(!!localStorage.getItem(STORAGE_KEY));
    window.addEventListener("storage", checkNotes);
    return () => window.removeEventListener("storage", checkNotes);
  }, []);

  const handleChange = (value: string) => {
    setNotes(value);
    localStorage.setItem(STORAGE_KEY, value);
    setHasNotes(!!value);
  };

  const handleClear = () => {
    if (confirm("Clear all notes?")) {
      setNotes("");
      localStorage.removeItem(STORAGE_KEY);
      setHasNotes(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface shadow-lg hover:bg-secondary"
        >
          <StickyNote className="h-5 w-5" strokeWidth={1.5} />
          {hasNotes && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-success" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-medium">Quick Notes</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Write your notes here..."
            className="h-[200px] text-[13px] resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{notes.length} characters</span>
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-muted-foreground hover:text-destructive"
            >
              Clear
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface FABAction {
  id: string;
  label: string;
  trigger: React.ReactNode | null;
}

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const inFabContainer = containerRef.current?.contains(target);
      const inOpenPopover = target.closest('[data-state="open"]');
      const inCalculatorPanel = target.closest('[data-floating-calculator="true"]');
      const isFabAction = target.closest('[data-fab-action="true"]');

      if (!inFabContainer && !inOpenPopover && !inCalculatorPanel && !isFabAction) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const actions: FABAction[] = [
    { id: "reminders", label: "Reminders", trigger: <ReminderPopover /> },
    { id: "calculator", label: "Calculator", trigger: <CalculatorPopover /> },
    { id: "converter", label: "Converter", trigger: <ConverterPopover /> },
    { id: "notes", label: "Notes", trigger: <NotesPopover /> },
  ];

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end"
    >
      {open && (
        <div className="flex flex-col gap-2 mb-2" data-fab-action="true">
          {actions.map((action, index) => (
            <div
              key={action.id}
              className="flex items-center justify-end gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200"
              style={{ animationDelay: `${(index + 1) * 60}ms` }}
            >
              <span className="text-[11px] text-muted-foreground bg-surface px-2 py-1 rounded border border-border whitespace-nowrap">
                {action.label}
              </span>
              {action.trigger}
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface shadow-lg transition-transform duration-200 hover:bg-secondary",
          open && "rotate-45"
        )}
      >
        <Plus className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <ReminderAutoPopup />
    </div>
  );
}