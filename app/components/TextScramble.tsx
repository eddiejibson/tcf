"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

const CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

interface TextScrambleProps {
  text: string;
  className?: string;
  duration?: number;
}

export default function TextScramble({
  text,
  className,
  duration = 1500,
}: TextScrambleProps) {
  const [displayed, setDisplayed] = useState(text);
  const hasPlayed = useRef(false);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.5 });

  useEffect(() => {
    if (!inView || hasPlayed.current) return;
    hasPlayed.current = true;

    const chars = text.split("");
    const totalFrames = Math.ceil(duration / 30);
    let frame = 0;
    let rafId: number;

    const scramble = () => {
      frame++;
      const progress = frame / totalFrames;
      const resolved = Math.floor(progress * chars.length);

      const output = chars
        .map((ch, i) => {
          if (ch === " ") return " ";
          if (i < resolved) return ch;
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        })
        .join("");

      setDisplayed(output);

      if (frame < totalFrames) {
        rafId = requestAnimationFrame(scramble);
      } else {
        setDisplayed(text);
      }
    };

    rafId = requestAnimationFrame(scramble);
    return () => cancelAnimationFrame(rafId);
  }, [inView, text, duration]);

  return (
    <span ref={ref} className={className}>
      {displayed}
    </span>
  );
}
