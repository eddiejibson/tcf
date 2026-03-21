"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

interface Location {
  name: string;
  description: string;
  x: number;
  y: number;
}

// Positions derived from the world-map.svg path data
// viewBox: 30.767 241.591 784.077 458.627
// xPct = (svgX - 30.767) / 784.077 * 100
// yPct = (svgY - 241.591) / 458.627 * 100
const LOCATIONS: Location[] = [
  {
    name: "Manila",
    x: 85.0,
    y: 51.8,
    description: "Wild-harvested livestock from the Philippines' diverse reef systems.",
  },
  {
    name: "Bali",
    x: 80.9,
    y: 66.6,
    description: "Hand-picked premium corals from Indonesia's richest reefs.",
  },
  {
    name: "Java",
    x: 79.9,
    y: 65.1,
    description: "Sustainably farmed corals from Indonesian aquaculture facilities.",
  },
  {
    name: "Australia",
    x: 92.8,
    y: 76.8,
    description: "World-class specimens from the Great Barrier Reef region.",
  },
  {
    name: "Haiti",
    x: 25.5,
    y: 52.0,
    description: "Rare Caribbean specimens from Haiti's tropical waters.",
  },
  {
    name: "Miami",
    x: 23.2,
    y: 47.2,
    description: "Aquacultured corals from Florida's specialist farms.",
  },
  {
    name: "Madagascar",
    x: 62.5,
    y: 73.6,
    description: "Rare deepwater species from the Indian Ocean.",
  },
  {
    name: "Kenya",
    x: 60.3,
    y: 64.2,
    description: "Sustainably harvested corals from East Africa's coastline.",
  },
  {
    name: "Djibouti",
    x: 61.2,
    y: 56.3,
    description: "Unique specimens from the Red Sea and Gulf of Aden.",
  },
  {
    name: "Solomon Islands",
    x: 97.1,
    y: 69.4,
    description: "Pristine wild colonies from some of the world's most untouched reefs.",
  },
  {
    name: "Taiwan",
    x: 84.6,
    y: 47.2,
    description: "High-quality aquacultured corals and frags.",
  },
  {
    name: "Vietnam",
    x: 80.8,
    y: 53.5,
    description: "Diverse tropical livestock from Vietnam's coastal reefs.",
  },
  {
    name: "Singapore",
    x: 80.2,
    y: 62.4,
    description: "Key trans-shipment hub for premium Indo-Pacific livestock.",
  },
  {
    name: "Thailand",
    x: 79.3,
    y: 54.6,
    description: "Hand-selected corals from Thailand's warm waters.",
  },
];

// London, UK origin
const UK = { x: 47.7, y: 30.8 };

const stockPing = `@keyframes source-ping{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.5);opacity:0}}`;

export default function SourceMap() {
  const [active, setActive] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback((i: number) => setActive(i), []);
  const handleLeave = useCallback(() => setActive(null), []);
  const handleTap = useCallback(
    (i: number, e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      setActive((prev) => (prev === i ? null : i));
    },
    []
  );

  // Dismiss tooltip when tapping outside markers
  const handleContainerTap = useCallback(() => {
    setActive(null);
  }, []);

  // Dismiss on scroll (mobile)
  useEffect(() => {
    if (active === null) return;
    const dismiss = () => setActive(null);
    window.addEventListener("scroll", dismiss, { passive: true });
    return () => window.removeEventListener("scroll", dismiss);
  }, [active]);

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      <style dangerouslySetInnerHTML={{ __html: stockPing }} />
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ aspectRatio: "784 / 459" }}
        onClick={handleContainerTap}
        onTouchEnd={handleContainerTap}
      >
        {/* Real world map SVG as background */}
        <img
          src="/images/world-map.svg"
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          style={{
            opacity: 0.08,
            filter: "invert(1) brightness(1.5) sepia(1) hue-rotate(180deg) saturate(3)",
          }}
        />

        {/* SVG overlay for route lines */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
        >
          {LOCATIONS.map((loc, i) => {
            const isActive = active === i;
            const mx = (UK.x + loc.x) / 2;
            const my = (UK.y + loc.y) / 2;
            const dx = loc.x - UK.x;
            const dy = loc.y - UK.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / dist;
            const ny = dx / dist;
            const offset = dist * 0.1;

            return (
              <path
                key={`route-${loc.name}`}
                d={`M${UK.x},${UK.y} Q${mx + nx * offset},${my + ny * offset} ${loc.x},${loc.y}`}
                fill="none"
                stroke={isActive ? "#0984E3" : "rgba(9,132,227,0.1)"}
                strokeWidth={isActive ? 0.3 : 0.12}
                strokeDasharray={isActive ? "none" : "0.5 0.5"}
                className="transition-all duration-300"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* UK origin marker */}
        <div
          className="absolute w-2.5 h-2.5 md:w-2 md:h-2 -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ left: `${UK.x}%`, top: `${UK.y}%` }}
        >
          <div className="w-full h-full rounded-full bg-[#0984E3]" />
        </div>

        {/* Location markers */}
        {LOCATIONS.map((loc, i) => {
          const isActive = active === i;
          const labelLeft = loc.x > 75;

          return (
            <div
              key={loc.name}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
              style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
              onMouseEnter={() => handleEnter(i)}
              onMouseLeave={handleLeave}
              onClick={(e) => handleTap(i, e)}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleTap(i, e);
              }}
            >
              {/* Larger invisible tap target for mobile */}
              <div className="absolute -inset-4 md:-inset-2" />
              {/* Ping animation */}
              <div
                className="absolute inset-0 -m-2 md:-m-1.5 rounded-full border border-[#0984E3]"
                style={{
                  animation: "source-ping 2.5s ease-out infinite",
                  animationDelay: `${i * 0.3}s`,
                }}
              />
              {/* Glow */}
              {isActive && (
                <div className="absolute -inset-3 rounded-full bg-[#0984E3]/20 blur-sm" />
              )}
              {/* Dot */}
              <div
                className={`relative rounded-full bg-[#0984E3] border-2 border-[#151b23] transition-all duration-200 ${
                  isActive ? "w-3.5 h-3.5 md:w-3 md:h-3 -m-0.5" : "w-2.5 h-2.5 md:w-2 md:h-2"
                }`}
              />
              {/* Label - only shown on hover/active to prevent overlap */}
              {isActive && (
                <span
                  className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-medium text-white select-none hidden md:block ${
                    labelLeft ? "right-full mr-2" : "left-full ml-2"
                  }`}
                >
                  {loc.name}
                </span>
              )}
            </div>
          );
        })}

        {/* Tooltip */}
        <AnimatePresence>
          {active !== null && (() => {
            const loc = LOCATIONS[active];
            const flipBelow = loc.y < 25;
            // For locations near the right edge, anchor from the right side instead
            const nearRight = loc.x > 85;
            const nearLeft = loc.x < 15;

            const posStyle: React.CSSProperties = {
              top: `${loc.y}%`,
            };

            if (nearRight) {
              // Anchor from right: distance from right edge = 100 - loc.x
              posStyle.right = `${100 - loc.x}%`;
              posStyle.transform = flipBelow
                ? "translate(0, calc(100% + 12px))"
                : "translate(0, calc(-100% - 12px))";
            } else if (nearLeft) {
              posStyle.left = `${loc.x}%`;
              posStyle.transform = flipBelow
                ? "translate(0, calc(100% + 12px))"
                : "translate(0, calc(-100% - 12px))";
            } else {
              posStyle.left = `${loc.x}%`;
              posStyle.transform = flipBelow
                ? "translate(-50%, calc(100% + 12px))"
                : "translate(-50%, calc(-100% - 12px))";
            }

            return (
              <motion.div
                key={active}
                initial={{ opacity: 0, y: flipBelow ? -6 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: flipBelow ? -6 : 6 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 pointer-events-none"
                style={posStyle}
              >
                <div className="bg-[#1a1f26]/95 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2.5 md:px-4 md:py-3 shadow-xl min-w-[160px] max-w-[200px] md:min-w-[180px] md:max-w-[220px]">
                  <p className="text-white font-semibold text-[11px] md:text-xs mb-1">
                    {loc.name}
                  </p>
                  <p className="text-white/50 text-[10px] leading-relaxed">
                    {loc.description}
                  </p>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}
