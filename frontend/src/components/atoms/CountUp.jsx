"use client";

import { useEffect, useState } from "react";

/** A number that counts up from zero when it first appears (instant with reduced motion). */
export default function CountUp({ value, decimals = 1, duration = 900, prefix = "", suffix = "" }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof value !== "number") return undefined;
    const length = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = length ? Math.min(1, (now - start) / length) : 1;
      setShown(value * (1 - (1 - t) ** 3)); // ease out
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  if (typeof value !== "number") return <>–</>;
  const done = Math.abs(shown - value) < 1e-9;
  const text = done ? String(value) : shown.toFixed(Number.isInteger(value) ? 0 : decimals);
  return (
    <>
      {prefix}
      {text}
      {suffix}
    </>
  );
}
