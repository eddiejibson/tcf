"use client";

import { useEffect, useRef } from "react";

export default function SpotlightCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rafId: number;
    let mx = 0;
    let my = 0;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const update = () => {
      el.style.setProperty("--cx", `${mx}px`);
      el.style.setProperty("--cy", `${my}px`);
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener("mousemove", onMove);
    rafId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="hidden md:block pointer-events-none fixed inset-0 z-[1]"
      style={{
        background:
          "radial-gradient(600px circle at var(--cx, -999px) var(--cy, -999px), rgba(9,132,227,0.06), transparent 60%)",
      }}
    />
  );
}
