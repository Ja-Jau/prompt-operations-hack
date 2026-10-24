"use client";

import { useEffect, useRef, useState } from "react";
import { formatEur } from "@/lib/format";

const DURATION_MS = 1100;

/** Counts up from zero to `value` like a slot machine, then calls `onDone`. */
export function RollingNumber({ value, onDone }: { value: number; onDone?: () => void }) {
  const [shown, setShown] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(value * eased);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        onDoneRef.current?.();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="tabular-nums">{formatEur(shown)}</span>;
}
