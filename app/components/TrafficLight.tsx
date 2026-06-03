"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

export type TrafficLightValue = "RED" | "AMBER" | "GREEN";

interface TrafficLightConfig {
  value: TrafficLightValue;
  label: string;
  dot: string; // background colour
  glow: string; // box-shadow halo so the dot reads as a lit LED
  text: string; // matching text colour
}

// Ordered green → amber → red so the menu reads like a real traffic light (top to bottom).
export const TRAFFIC_LIGHTS: TrafficLightConfig[] = [
  { value: "GREEN", label: "Green", dot: "bg-emerald-400", glow: "shadow-[0_0_9px_1px_rgba(52,211,153,0.75)]", text: "text-emerald-400" },
  { value: "AMBER", label: "Amber", dot: "bg-amber-400", glow: "shadow-[0_0_9px_1px_rgba(251,191,36,0.8)]", text: "text-amber-400" },
  { value: "RED", label: "Red", dot: "bg-red-500", glow: "shadow-[0_0_9px_1px_rgba(248,113,113,0.75)]", text: "text-red-400" },
];

export function trafficLightConfig(value: string | null | undefined): TrafficLightConfig {
  return TRAFFIC_LIGHTS.find((t) => t.value === value) ?? TRAFFIC_LIGHTS[1]; // default AMBER
}

const SIZES = { sm: "h-2.5 w-2.5", md: "h-3 w-3", lg: "h-4 w-4" } as const;

/** Display-only lit dot. */
export function TrafficLightDot({
  value,
  size = "md",
  className = "",
}: {
  value: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const cfg = trafficLightConfig(value);
  return (
    <span
      aria-hidden
      title={cfg.label}
      className={`inline-block shrink-0 rounded-full ring-1 ring-white/25 ${SIZES[size]} ${cfg.dot} ${cfg.glow} ${className}`}
    />
  );
}

interface TrafficLightPickerProps {
  value: string | null | undefined;
  onChange: (value: TrafficLightValue) => void;
  /** "dot" = bare clickable LED, "full" = bordered control with label + chevron. */
  variant?: "dot" | "full";
  /** Dot size for the "dot" variant. */
  size?: keyof typeof SIZES;
  disabled?: boolean;
  className?: string;
}

/** Click the colour to open a small dropdown and pick a new one. */
export function TrafficLightPicker({ value, onChange, variant = "dot", size = "md", disabled = false, className = "" }: TrafficLightPickerProps) {
  const cfg = trafficLightConfig(value);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // The menu is fixed-positioned, so close it if the page scrolls or resizes under it.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setCoords({ top: r.bottom + 6, left: r.left });
    }
    setOpen((o) => !o);
  };

  const choose = (e: MouseEvent, v: TrafficLightValue) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    if (v !== value) onChange(v);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={`Traffic light: ${cfg.label}`}
        className={
          variant === "full"
            ? `flex items-center gap-2.5 min-w-[130px] pl-3 pr-2.5 py-2 bg-white/5 border rounded-lg transition-colors ${open ? "border-[#0984E3]/50" : "border-white/10 hover:border-white/20"} ${disabled ? "opacity-60 cursor-default" : ""} ${className}`
            : `group inline-flex items-center justify-center rounded-full p-1 -m-1 transition-colors ${disabled ? "cursor-default" : "cursor-pointer hover:bg-white/10"} ${className}`
        }
      >
        <TrafficLightDot value={value} size={variant === "full" ? "md" : size} />
        {variant === "full" && (
          <>
            <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
            <svg className={`w-4 h-4 text-white/30 ml-auto transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>

      {/* open only flips true from a client click, so the portal never runs during SSR */}
      {open && coords && createPortal(
        <>
          {/* invisible catcher closes the menu on any outside click */}
          <div className="fixed inset-0 z-[120]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }} />
          <div
            role="listbox"
            className="fixed z-[121] py-1 min-w-[150px] bg-[#1a1f26] border border-white/10 rounded-xl shadow-2xl shadow-black/60"
            style={{ top: coords.top, left: coords.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {TRAFFIC_LIGHTS.map((t) => {
              const active = t.value === value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={(e) => choose(e, t.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${active ? "bg-white/[0.07]" : "hover:bg-white/5"}`}
                >
                  <TrafficLightDot value={t.value} size="md" />
                  <span className={`text-sm font-medium ${active ? t.text : "text-white/70"}`}>{t.label}</span>
                  {active && (
                    <svg className="w-3.5 h-3.5 ml-auto text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
