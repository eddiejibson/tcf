"use client";

import { useMemo } from "react";

interface BubbleParticlesProps {
  mobile?: boolean;
}

export default function BubbleParticles({ mobile = false }: BubbleParticlesProps) {
  const count = mobile ? 10 : 18;

  const bubbles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const size = 3 + Math.random() * 9;
      const left = Math.random() * 100;
      const duration = 8 + Math.random() * 12;
      const delay = Math.random() * duration;
      const drift = -20 + Math.random() * 40;
      return { size, left, duration, delay, drift, key: i };
    });
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {bubbles.map((b) => (
        <div
          key={b.key}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
            bottom: `-${b.size}px`,
            background:
              "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), rgba(9,132,227,0.2) 60%, transparent)",
            boxShadow: "inset 0 0 3px rgba(255,255,255,0.15)",
            animation: `bubble-rise ${b.duration}s linear ${b.delay}s infinite`,
            ["--bubble-drift" as string]: `${b.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
