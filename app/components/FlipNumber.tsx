"use client";

import { AnimatePresence, motion } from "framer-motion";

interface FlipNumberProps {
  value: string;
  className?: string;
}

export default function FlipNumber({ value, className }: FlipNumberProps) {
  const chars = value.split("");

  return (
    <span className={`inline-flex ${className ?? ""}`}>
      {chars.map((char, i) => (
        <span
          key={`${i}-pos`}
          className="relative inline-block overflow-hidden"
          style={{ height: "1em", lineHeight: "1em" }}
        >
          <AnimatePresence mode="popLayout">
            <motion.span
              key={`${i}-${char}`}
              className="inline-block"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
