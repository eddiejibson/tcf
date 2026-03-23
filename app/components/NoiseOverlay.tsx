"use client";

export default function NoiseOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.03] mix-blend-overlay"
      style={{ animation: "grain 0.5s steps(1) infinite" }}
    >
      <svg width="100%" height="100%">
        <filter id="noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="4"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    </div>
  );
}
