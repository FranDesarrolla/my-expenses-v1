import { useState, useRef, useEffect, useCallback } from "react";
import { Calculator as CalculatorIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Calculator() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [previous, setPrevious] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setPosition({
        x: window.innerWidth - rect.width - 24,
        y: window.innerHeight - rect.height - 140,
      });
    }
  }, [open]);

  const calculate = useCallback((a: string, b: string, op: string): string => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    switch (op) {
      case "+": return String(numA + numB);
      case "-": return String(numA - numB);
      case "*": return String(numA * numB);
      case "/": return numB !== 0 ? String(numA / numB) : "Error";
      default: return b;
    }
  }, []);

  const handleInput = useCallback((value: string) => {
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
  }, [display, operator, previous, calculate]);

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
  }, [open, handleInput]);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  useEffect(() => {
    if (!dragging) return;

    function handleMouseMove(e: MouseEvent) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }

    function handleMouseUp() {
      setDragging(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, dragOffset]);

  const buttons = [
    "C", "⌫", "/", "*",
    "7", "8", "9", "-",
    "4", "5", "6", "+",
    "1", "2", "3", "=",
    "0", ".",
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[84px] right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface shadow-lg hover:bg-secondary"
      >
        <CalculatorIcon className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-50 rounded-lg border border-border bg-surface p-4 shadow-xl"
          style={{
            left: position.x,
            top: position.y,
            width: "320px",
            cursor: dragging ? "grabbing" : "grab",
          }}
          onMouseDown={handleDragStart}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">Calculator</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
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
      )}
    </>
  );
}