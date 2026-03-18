"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";

interface Location {
  name: string;
  description: string;
  // Percentage positions on the map image (manually mapped to the SVG projection)
  x: number;
  y: number;
}

// Positions mapped to the world-map.svg viewBox (30.767, 241.591, 784, 458.6)
// Conversion: xPct = (svgX - 30.767) / 784.077 * 100
//              yPct = (svgY - 241.591) / 458.627 * 100
const LOCATIONS: Location[] = [
  {
    name: "Madagascar",
    x: 63.5,
    y: 71.5,
    description:
      "Rare deepwater Acropora & vibrant soft corals from the Indian Ocean.",
  },
  {
    name: "Bali",
    x: 84.2,
    y: 60.2,
    description:
      "Hand-picked Euphyllia, Goniopora & premium LPS from Indonesian reefs.",
  },
  {
    name: "Solomon Islands",
    x: 93.5,
    y: 55.5,
    description:
      "Pristine wild colonies and unique colour morphs from untouched reefs.",
  },
  {
    name: "Australia",
    x: 88.5,
    y: 73,
    description:
      "World-class Acropora & Chalice from the Great Barrier Reef region.",
  },
  {
    name: "Kenya",
    x: 59.5,
    y: 55.5,
    description:
      "Sustainably harvested corals from East Africa's coastal waters.",
  },
  {
    name: "Caribbean",
    x: 27,
    y: 43,
    description:
      "Aquacultured Gorgonians, Ricordea & rare Caribbean specimens.",
  },
];

// London, UK origin (mapped from SVG coords ~405, 383)
const UK = { x: 47.7, y: 30.8 };

export default function SourceMap() {
  const [active, setActive] = useState<number | null>(null);

  const handleEnter = useCallback((i: number) => setActive(i), []);
  const handleLeave = useCallback(() => setActive(null), []);
  const handleClick = useCallback(
    (i: number) => setActive((prev) => (prev === i ? null : i)),
    []
  );

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Map container with proper aspect ratio */}
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{
          aspectRatio: "784 / 459",
          background: "#0b1117",
        }}
      >
        {/* Real world map SVG as background - styled dark with CSS */}
        <img
          src="/images/world-map.svg"
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
          style={{
            opacity: 0.07,
            filter: "invert(1) brightness(2)",
          }}
        />

        {/* SVG overlay for interactive elements */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Route lines from UK to each source */}
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
          className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ left: `${UK.x}%`, top: `${UK.y}%` }}
        >
          <div className="w-full h-full rounded-full bg-[#0984E3]" />
        </div>

        {/* Location markers */}
        {LOCATIONS.map((loc, i) => {
          const isActive = active === i;
          return (
            <div
              key={loc.name}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
              style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
              onMouseEnter={() => handleEnter(i)}
              onMouseLeave={handleLeave}
              onClick={() => handleClick(i)}
            >
              {/* Ping animation */}
              <div
                className="absolute inset-0 -m-1.5 rounded-full border border-[#0984E3]"
                style={{
                  animation: "source-ping 2.5s ease-out infinite",
                  animationDelay: `${i * 0.4}s`,
                }}
              />
              {/* Glow */}
              {isActive && (
                <div className="absolute -inset-3 rounded-full bg-[#0984E3]/20 blur-sm" />
              )}
              {/* Dot */}
              <div
                className={`relative rounded-full bg-[#0984E3] border-2 border-[#0b1117] transition-all duration-200 ${
                  isActive ? "w-3 h-3 -m-0.5" : "w-2 h-2"
                }`}
              />
              {/* Label */}
              <span
                className={`absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] md:text-xs font-medium transition-all duration-200 select-none ${
                  isActive ? "text-white" : "text-white/30"
                }`}
              >
                {loc.name}
              </span>
            </div>
          );
        })}

        {/* Tooltip */}
        <AnimatePresence>
          {active !== null && (
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 pointer-events-none"
              style={{
                left: `${LOCATIONS[active].x}%`,
                top: `${LOCATIONS[active].y}%`,
                transform: "translate(-50%, calc(-100% - 16px))",
              }}
            >
              <div className="bg-[#1a1f26]/95 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3 shadow-xl min-w-[180px] max-w-[220px]">
                <p className="text-white font-semibold text-xs mb-1">
                  {LOCATIONS[active].name}
                </p>
                <p className="text-white/50 text-[10px] leading-relaxed">
                  {LOCATIONS[active].description}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
