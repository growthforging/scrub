import { useEffect, useRef, useState } from "react";

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * Counts to `value` instead of snapping. Byte totals change as files arrive
 * and the roll is what makes the tally read as a live measurement rather than
 * a label that got replaced.
 */
export function AnimatedNumber({
  value,
  duration = 560,
  format = (n: number) => Math.round(n).toLocaleString(),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    if (delta === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      from.current = value;
      setShown(value);
      return;
    }

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = origin + delta * easeOut(t);
      setShown(next);
      if (t < 1) {
        raf.current = requestAnimationFrame(step);
      } else {
        from.current = value;
      }
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return <span className={`num ${className ?? ""}`}>{format(shown)}</span>;
}
