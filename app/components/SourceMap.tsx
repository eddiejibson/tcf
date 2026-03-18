"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";

interface Location {
  name: string;
  description: string;
  lat: number;
  lon: number;
}

const LOCATIONS: Location[] = [
  {
    name: "Madagascar",
    description:
      "Rare deepwater Acropora & vibrant soft corals from the Indian Ocean.",
    lat: -18.77,
    lon: 46.87,
  },
  {
    name: "Bali",
    description:
      "Hand-picked Euphyllia, Goniopora & premium LPS from Indonesian reefs.",
    lat: -8.34,
    lon: 115.09,
  },
  {
    name: "Solomon Islands",
    description:
      "Pristine wild colonies and unique colour morphs from untouched reefs.",
    lat: -9.43,
    lon: 160.03,
  },
  {
    name: "Australia",
    description:
      "World-class Acropora & Chalice from the Great Barrier Reef region.",
    lat: -23.7,
    lon: 150.5,
  },
  {
    name: "Kenya",
    description:
      "Sustainably harvested corals from East Africa's coastal waters.",
    lat: -4.04,
    lon: 39.67,
  },
  {
    name: "Caribbean",
    description:
      "Aquacultured Gorgonians, Ricordea & rare Caribbean specimens.",
    lat: 18.22,
    lon: -66.59,
  },
];

// UK origin
const UK = { lat: 51.5, lon: -1.0 };

function toSvg(lat: number, lon: number): [number, number] {
  return [((lon + 180) / 360) * 1000, ((90 - lat) / 180) * 500];
}

function arcPath(from: [number, number], to: [number, number]): string {
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = dist * 0.12;
  const nx = -dy / dist;
  const ny = dx / dist;
  return `M${from[0]},${from[1]} Q${mx + nx * offset},${my + ny * offset} ${to[0]},${to[1]}`;
}

const ukPos = toSvg(UK.lat, UK.lon);

// Continent fill paths for dot-matrix clipping (equirectangular 1000x500)
const CONTINENT_PATHS = [
  // North America (Alaska through Central America)
  "M64,53 L83,62 L75,75 L83,81 L90,90 L100,97 L130,100 L155,100 L158,114 L158,118 L160,130 L160,145 L168,156 L175,165 L185,175 L195,185 L200,195 L210,205 L225,215 L235,225 L249,235 L260,242 L275,248 L279,252 L270,252 L258,248 L245,240 L232,235 L220,228 L210,220 L200,215 L188,210 L180,205 L172,196 L165,185 L160,175 L155,165 L150,156 L142,150 L135,145 L128,140 L118,138 L110,135 L105,130 L106,122 L115,115 L128,110 L140,105 L150,100 L155,92 L160,85 L155,78 L148,72 L140,68 L130,65 L118,62 L105,58 L95,55 L80,50 L70,50 Z M250,55 L280,52 L310,55 L330,62 L340,72 L342,82 L340,90 L335,100 L333,105 L325,115 L315,126 L305,132 L294,137 L285,148 L280,158 L277,168 L277,178 L278,185 L272,192 L262,192 L250,188 L238,178 L235,170 L238,162 L245,155 L252,148 L258,140 L264,130 L268,118 L270,108 L268,98 L264,90 L260,82 L258,72 L254,62 Z",
  // South America
  "M279,252 L290,248 L305,244 L320,242 L338,244 L350,250 L365,254 L380,258 L400,262 L408,268 L405,275 L398,282 L388,290 L380,298 L375,308 L372,318 L365,328 L358,338 L350,345 L342,350 L335,358 L325,368 L318,378 L312,388 L308,398 L310,405 L305,410 L298,408 L290,400 L285,390 L280,378 L278,365 L275,350 L272,338 L270,325 L268,312 L266,298 L265,285 L266,275 L270,265 L275,258 Z",
  // Europe
  "M440,72 L448,68 L458,62 L470,60 L485,58 L498,60 L510,62 L520,60 L535,58 L548,62 L555,68 L560,75 L568,82 L575,85 L582,88 L590,92 L598,95 L605,98 L608,105 L605,110 L598,115 L590,118 L582,122 L575,128 L568,132 L560,135 L552,138 L545,140 L538,138 L530,135 L522,132 L515,128 L508,125 L500,125 L492,128 L485,132 L478,135 L472,138 L466,140 L462,142 L458,138 L455,132 L452,125 L450,118 L448,110 L445,102 L442,95 L440,85 Z",
  // Africa
  "M462,148 L470,145 L478,142 L488,145 L498,148 L510,148 L522,150 L535,152 L548,155 L558,158 L568,162 L578,168 L585,172 L592,178 L598,185 L605,192 L612,200 L618,210 L622,218 L625,228 L622,238 L618,245 L612,252 L608,260 L605,268 L600,278 L595,288 L590,298 L585,308 L578,318 L572,325 L565,332 L558,338 L550,342 L542,345 L535,342 L528,338 L520,332 L512,325 L505,318 L498,310 L492,300 L488,290 L485,278 L482,268 L478,258 L475,248 L472,238 L470,228 L468,218 L465,208 L462,198 L460,188 L458,178 L458,168 L460,158 Z",
  // Madagascar
  "M625,280 L632,278 L638,282 L640,292 L638,302 L635,312 L630,318 L625,315 L622,305 L620,295 L622,288 Z",
  // Asia (mainland Russia through Southeast Asia)
  "M608,55 L630,48 L660,45 L695,48 L730,52 L760,55 L790,58 L820,62 L850,65 L875,68 L895,72 L910,78 L920,82 L935,85 L942,92 L945,100 L942,105 L935,108 L925,105 L910,102 L895,100 L880,98 L870,95 L866,100 L870,108 L875,115 L878,122 L875,128 L870,132 L866,138 L860,142 L855,148 L850,152 L845,155 L838,158 L830,162 L823,158 L818,152 L812,148 L805,145 L798,142 L790,140 L782,138 L775,135 L768,132 L760,128 L752,125 L745,122 L738,118 L730,115 L722,112 L715,110 L708,108 L700,105 L692,102 L685,100 L678,98 L670,95 L662,92 L655,90 L648,88 L640,85 L632,82 L625,80 L618,78 L612,75 L608,68 Z",
  // Middle East / Arabian Peninsula
  "M575,140 L585,138 L598,142 L610,148 L622,152 L635,155 L648,158 L658,162 L668,168 L675,175 L680,182 L678,190 L672,195 L665,198 L655,200 L645,198 L635,195 L625,192 L618,188 L612,182 L605,175 L598,168 L592,162 L585,155 L580,148 Z",
  // India + Sri Lanka
  "M685,162 L695,158 L708,162 L718,168 L725,178 L728,190 L725,200 L720,210 L715,220 L710,228 L705,232 L698,228 L692,222 L688,212 L685,200 L682,190 L680,180 L682,172 Z",
  // China / East Asia
  "M730,92 L748,88 L768,92 L785,98 L795,105 L802,112 L808,120 L812,128 L818,135 L822,142 L828,148 L835,155 L838,162 L835,168 L828,172 L820,175 L812,178 L805,182 L798,185 L790,188 L782,185 L775,180 L768,175 L760,170 L752,165 L745,160 L738,155 L732,148 L728,140 L725,132 L722,122 L720,112 L722,102 Z",
  // Japan
  "M878,115 L882,108 L888,105 L892,110 L895,118 L892,128 L888,138 L885,148 L880,152 L875,148 L872,140 L875,130 L878,122 Z",
  // Korea
  "M852,118 L858,112 L862,118 L865,128 L862,138 L858,142 L852,138 L850,128 Z",
  // Southeast Asia peninsula
  "M768,180 L778,178 L788,182 L798,190 L802,200 L800,210 L795,218 L788,225 L780,230 L772,232 L765,228 L760,220 L758,210 L760,200 L762,190 Z",
  // Indonesia archipelago
  "M788,248 L800,245 L815,248 L830,252 L842,255 L850,260 L848,268 L838,272 L825,275 L810,278 L798,278 L788,275 L782,268 L785,258 Z",
  // Philippines
  "M832,195 L838,192 L842,198 L840,208 L835,215 L830,210 L828,202 Z",
  // Australia
  "M838,298 L858,290 L878,288 L898,292 L915,300 L925,312 L930,325 L928,340 L922,352 L912,362 L898,370 L882,375 L865,372 L850,365 L840,355 L835,342 L832,328 L835,312 Z",
  // New Zealand
  "M958,358 L965,352 L970,358 L968,372 L962,382 L955,385 L952,378 L952,368 Z",
].join(" ");

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
      <svg
        viewBox="0 0 1000 500"
        className="w-full h-auto rounded-2xl overflow-hidden"
        style={{ background: "#0b1120" }}
      >
        <defs>
          {/* Dot pattern */}
          <pattern
            id="dot-grid"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="5" cy="5" r="1" fill="rgba(255,255,255,0.18)" />
          </pattern>

          {/* Continent clip path */}
          <clipPath id="continents-clip">
            <path d={CONTINENT_PATHS} fillRule="evenodd" />
          </clipPath>

          {/* Glow filter for active markers */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dot-matrix continents */}
        <rect
          width="1000"
          height="500"
          fill="url(#dot-grid)"
          clipPath="url(#continents-clip)"
        />

        {/* Route arcs from UK to each source */}
        {LOCATIONS.map((loc, i) => {
          const target = toSvg(loc.lat, loc.lon);
          const isActive = active === i;
          return (
            <path
              key={`route-${loc.name}`}
              d={arcPath(ukPos, target)}
              fill="none"
              stroke={isActive ? "#0984E3" : "rgba(9,132,227,0.12)"}
              strokeWidth={isActive ? 1.5 : 0.6}
              strokeDasharray={isActive ? "none" : "3 3"}
              className="transition-all duration-300"
            />
          );
        })}

        {/* UK origin dot */}
        <circle cx={ukPos[0]} cy={ukPos[1]} r={3} fill="#0984E3" />

        {/* Location markers */}
        {LOCATIONS.map((loc, i) => {
          const [x, y] = toSvg(loc.lat, loc.lon);
          const isActive = active === i;
          return (
            <g
              key={loc.name}
              className="cursor-pointer"
              onClick={() => handleClick(i)}
              onMouseEnter={() => handleEnter(i)}
              onMouseLeave={handleLeave}
            >
              {/* Ping ring */}
              <circle
                cx={x}
                cy={y}
                r={5}
                fill="none"
                stroke="#0984E3"
                strokeWidth={1}
                style={{
                  transformOrigin: `${x}px ${y}px`,
                  animation: "source-ping 2.5s ease-out infinite",
                  animationDelay: `${i * 0.4}s`,
                }}
              />
              {/* Glow when active */}
              {isActive && (
                <circle
                  cx={x}
                  cy={y}
                  r={8}
                  fill="rgba(9,132,227,0.2)"
                  filter="url(#glow)"
                />
              )}
              {/* Solid dot */}
              <circle
                cx={x}
                cy={y}
                r={isActive ? 4 : 3}
                fill="#0984E3"
                stroke="#0b1120"
                strokeWidth={1.5}
                className="transition-all duration-200"
              />
              {/* Hit area */}
              <circle cx={x} cy={y} r={20} fill="transparent" />
            </g>
          );
        })}

        {/* Location labels */}
        {LOCATIONS.map((loc, i) => {
          const [x, y] = toSvg(loc.lat, loc.lon);
          const isActive = active === i;
          return (
            <text
              key={`label-${loc.name}`}
              x={x + 10}
              y={y + 4}
              fill={isActive ? "#ffffff" : "rgba(255,255,255,0.3)"}
              fontSize={isActive ? 11 : 10}
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight={isActive ? 600 : 400}
              className="transition-all duration-200 pointer-events-none select-none"
            >
              {loc.name}
            </text>
          );
        })}
      </svg>

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
              left: `${(toSvg(LOCATIONS[active].lat, LOCATIONS[active].lon)[0] / 1000) * 100}%`,
              top: `${(toSvg(LOCATIONS[active].lat, LOCATIONS[active].lon)[1] / 500) * 100}%`,
              transform: "translate(-50%, -130%)",
            }}
          >
            <div className="bg-[#1a1f26] border border-white/10 rounded-lg px-4 py-3 shadow-xl min-w-[200px] max-w-[240px]">
              <p className="text-white font-semibold text-sm mb-1">
                {LOCATIONS[active].name}
              </p>
              <p className="text-white/50 text-xs leading-relaxed">
                {LOCATIONS[active].description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
