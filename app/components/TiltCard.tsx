"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}

export default function TiltCard({ children, className, maxTilt = 8 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);

  const springRotateX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 200, damping: 20 });

  const handleMouse = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateX.set((py - 0.5) * -maxTilt * 2);
    rotateY.set((px - 0.5) * maxTilt * 2);
    glareX.set(px * 100);
    glareY.set(py * 100);
  };

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <>
      {/* Desktop: tilt effect */}
      <motion.div
        ref={ref}
        className={`hidden md:block ${className ?? ""}`}
        style={{
          perspective: 1000,
          rotateX: springRotateX,
          rotateY: springRotateY,
          transformStyle: "preserve-3d",
        }}
        onMouseMove={handleMouse}
        onMouseLeave={reset}
      >
        {children}
      </motion.div>
      {/* Mobile: no tilt */}
      <div className={`md:hidden ${className ?? ""}`}>{children}</div>
    </>
  );
}
