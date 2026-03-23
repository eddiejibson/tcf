"use client";

import { useRef } from "react";
import { motion, useScroll, useVelocity, useSpring, useTransform } from "framer-motion";

interface ScrollVelocityTextProps {
  children: React.ReactNode;
  className?: string;
}

export default function ScrollVelocityText({
  children,
  className,
}: ScrollVelocityTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(velocity, { stiffness: 100, damping: 30 });
  const skewX = useTransform(smoothVelocity, [-1000, 0, 1000], [-3, 0, 3]);
  const translateX = useTransform(smoothVelocity, [-1000, 0, 1000], [-8, 0, 8]);

  return (
    <motion.div ref={ref} className={className} style={{ skewX, x: translateX }}>
      {children}
    </motion.div>
  );
}
