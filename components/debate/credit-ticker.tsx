"use client";

import { useEffect, useState } from "react";

export function CreditTicker({
  from,
  to,
  durationMs = 800,
  className = "",
}: {
  from: number;
  to: number;
  durationMs?: number;
  className?: string;
}) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Slight overshoot bounce.
      const eased =
        t < 1
          ? 1 - Math.pow(1 - t, 3)
          : 1 + Math.sin((t - 1) * Math.PI) * 0.04;
      const next = Math.round(from + (to - from) * eased);
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, durationMs]);
  return <span className={`font-mono-num tabular-nums ${className}`}>{value}</span>;
}
