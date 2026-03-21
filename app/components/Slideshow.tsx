"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useMemo } from "react";
import { buildShuffledSlides } from "@/app/lib/coral-slides";

const INTERVAL = 4000; // 4 seconds per image

interface SlideshowProps {
  onSlideChange?: (name: string) => void;
}

export default function Slideshow({ onSlideChange }: SlideshowProps) {
  const slides = useMemo(() => buildShuffledSlides(), []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const onSlideChangeRef = useRef(onSlideChange);
  onSlideChangeRef.current = onSlideChange;

  // Fire initial slide name
  useEffect(() => {
    onSlideChangeRef.current?.(slides[0]?.name ?? "");
  }, [slides]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % slides.length;
        onSlideChangeRef.current?.(slides[next].name);
        return next;
      });
    }, INTERVAL);

    return () => clearInterval(timer);
  }, [slides]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {slides.map((img, i) => (
        <div
          key={img.src}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={img.src}
            alt={img.alt}
            fill
            className="object-cover"
            priority={i < 3}
          />
        </div>
      ))}
      {/* Gradient overlay for better text contrast if needed */}
      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#151b23]/30" />
    </div>
  );
}
