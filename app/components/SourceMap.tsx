"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

interface Location {
  name: string;
  description: string;
  lat: number;
  lon: number;
}

const LOCATIONS: Location[] = [
  {
    name: "Madagascar",
    description: "Rare deepwater Acropora & vibrant soft corals from the Indian Ocean.",
    lat: -18.77,
    lon: 46.87,
  },
  {
    name: "Bali",
    description: "Hand-picked Euphyllia, Goniopora & premium LPS from Indonesian reefs.",
    lat: -8.34,
    lon: 115.09,
  },
  {
    name: "Solomon Islands",
    description: "Pristine wild colonies and unique colour morphs from untouched reefs.",
    lat: -9.43,
    lon: 160.03,
  },
  {
    name: "Australia",
    description: "World-class Acropora & Chalice from the Great Barrier Reef region.",
    lat: -23.7,
    lon: 150.5,
  },
  {
    name: "Kenya",
    description: "Sustainably harvested corals from East Africa's coastal waters.",
    lat: -4.04,
    lon: 39.67,
  },
  {
    name: "Caribbean",
    description: "Aquacultured Gorgonians, Ricordea & rare Caribbean specimens.",
    lat: 18.22,
    lon: -66.59,
  },
];

function toSvg(lat: number, lon: number): { x: number; y: number } {
  return {
    x: ((lon + 180) / 360) * 1000,
    y: ((90 - lat) / 180) * 500,
  };
}

// Simplified continent outlines (equirectangular projection, viewBox 0 0 1000 500)
const CONTINENTS = (
  <>
    {/* Africa */}
    <path
      d="M480,140 L500,130 L520,140 L530,160 L540,200 L545,240 L540,280 L530,320 L520,350 L510,370 L500,380 L490,370 L480,350 L470,320 L465,290 L460,260 L458,230 L460,200 L465,170 Z"
      fill="#1e2530"
    />
    {/* Europe */}
    <path
      d="M460,80 L480,70 L510,75 L530,80 L540,90 L535,105 L525,115 L510,120 L495,125 L480,130 L470,125 L460,115 L455,100 Z"
      fill="#1e2530"
    />
    {/* Asia */}
    <path
      d="M540,60 L580,50 L630,45 L680,50 L720,60 L760,75 L780,95 L790,120 L785,150 L770,170 L750,180 L720,185 L690,180 L660,170 L640,160 L620,165 L610,180 L620,200 L640,210 L660,200 L680,205 L700,220 L710,240 L700,260 L680,260 L660,250 L640,245 L620,240 L600,230 L580,210 L560,190 L545,170 L540,150 L535,120 L540,90 Z"
      fill="#1e2530"
    />
    {/* North America */}
    <path
      d="M120,60 L160,50 L200,55 L240,65 L270,80 L290,100 L300,120 L295,145 L280,165 L260,180 L240,190 L220,200 L200,210 L185,220 L175,230 L170,210 L160,190 L145,175 L130,165 L115,150 L105,130 L100,110 L105,90 L110,75 Z"
      fill="#1e2530"
    />
    {/* South America */}
    <path
      d="M230,250 L250,240 L270,245 L285,260 L295,280 L300,310 L295,340 L285,370 L270,390 L255,400 L240,405 L230,395 L222,375 L218,350 L215,320 L218,290 L222,265 Z"
      fill="#1e2530"
    />
    {/* Australia */}
    <path
      d="M750,310 L780,300 L810,305 L835,315 L850,330 L850,350 L840,365 L820,375 L795,378 L770,370 L755,355 L748,340 L745,325 Z"
      fill="#1e2530"
    />
    {/* Indonesia archipelago */}
    <path
      d="M700,265 L720,260 L740,262 L755,268 L760,275 L750,282 L735,285 L715,283 L700,278 Z"
      fill="#1e2530"
    />
  </>
);

export default function SourceMap() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      <svg
        viewBox="0 0 1000 500"
        className="w-full h-auto"
        style={{ background: "#141920", borderRadius: "16px" }}
      >
        {/* Grid lines */}
        {[0, 30, 60, 90, 120, 150, 180].map((lat) => (
          <line
            key={`lat-${lat}`}
            x1={0}
            y1={(lat / 180) * 500}
            x2={1000}
            y2={(lat / 180) * 500}
            stroke="rgba(9,132,227,0.06)"
            strokeWidth={0.5}
          />
        ))}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].map(
          (lon) => (
            <line
              key={`lon-${lon}`}
              x1={(lon / 360) * 1000}
              y1={0}
              x2={(lon / 360) * 1000}
              y2={500}
              stroke="rgba(9,132,227,0.06)"
              strokeWidth={0.5}
            />
          )
        )}

        {/* Continent outlines */}
        {CONTINENTS}

        {/* Location markers */}
        {LOCATIONS.map((loc, i) => {
          const { x, y } = toSvg(loc.lat, loc.lon);
          return (
            <g
              key={loc.name}
              className="cursor-pointer"
              onClick={() => setActive(active === i ? null : i)}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {/* Pulsing outer ring */}
              <circle
                cx={x}
                cy={y}
                r={8}
                fill="none"
                stroke="#0984E3"
                strokeWidth={1.5}
                opacity={0.6}
                style={{
                  transformOrigin: `${x}px ${y}px`,
                  animation: "source-ping 2s ease-out infinite",
                  animationDelay: `${i * 0.3}s`,
                }}
              />
              {/* Inner solid dot */}
              <circle
                cx={x}
                cy={y}
                r={5}
                fill="#0984E3"
                stroke="#141920"
                strokeWidth={2}
              />
              {/* Larger invisible hit area */}
              <circle cx={x} cy={y} r={20} fill="transparent" />
            </g>
          );
        })}
      </svg>

      {/* Tooltip overlay */}
      <AnimatePresence>
        {active !== null && (
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 pointer-events-none"
            style={{
              left: `${(toSvg(LOCATIONS[active].lat, LOCATIONS[active].lon).x / 1000) * 100}%`,
              top: `${(toSvg(LOCATIONS[active].lat, LOCATIONS[active].lon).y / 500) * 100}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl px-4 py-3 shadow-2xl min-w-[200px] max-w-[260px]">
              <p className="text-[#0984E3] font-bold text-sm mb-1">
                {LOCATIONS[active].name}
              </p>
              <p className="text-white/70 text-xs leading-relaxed">
                {LOCATIONS[active].description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
