import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, monthLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function MonthSelector({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange(addMonths(value, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
      </Button>
      <div className="num min-w-[140px] text-center text-[13px] tracking-tight">
        {monthLabel(value)}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onChange(addMonths(value, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
}
