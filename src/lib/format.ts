// Currency + date helpers — all calculations in cents to avoid float drift.
export const toCents = (n: number) => Math.round(n * 100);
export const fromCents = (n: number) => n / 100;

export function formatMoney(value: number | null | undefined, opts?: { sign?: boolean }) {
  const v = value ?? 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(v));
  const prefix = opts?.sign && v > 0 ? "+" : v < 0 ? "−" : "";
  return `${prefix}$${formatted}`;
}

export function monthKey(d: Date) {
  // First day of month, ISO date string (yyyy-mm-dd) for storage
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString().slice(0, 10);
}

export function monthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function monthShort(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short" });
}

export function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonthISO(d: Date) {
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return e.toISOString().slice(0, 10);
}

export function startOfMonthISO(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
