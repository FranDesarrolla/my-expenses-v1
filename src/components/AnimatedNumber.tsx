import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({
  value,
  duration = 400,
  prefix = "",
  decimals = 2,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const ease = (t: number) => 1 - Math.pow(1 - t, 4); // out-quart-ish

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const v = fromRef.current + (value - fromRef.current) * ease(t);
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(display));

  return (
    <span className="num">
      {display < 0 ? "−" : ""}
      {prefix}
      {formatted}
    </span>
  );
}
