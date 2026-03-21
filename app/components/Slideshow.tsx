"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { buildSlides } from "@/app/lib/coral-slides";

const INTERVAL = 4000; // 4 seconds per image

// Fixed order — deterministic, no hydration issues
const slides = buildSlides();

interface SlideshowProps {
  onSlideChange?: (name: string) => void;
}

export default function Slideshow({ onSlideChange }: SlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const onSlideChangeRef = useRef(onSlideChange);
  onSlideChangeRef.current = onSlideChange;

  // Fire initial slide name
  useEffect(() => {
    onSlideChangeRef.current?.(slides[0]?.name ?? "");
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        const currentName = slides[prev].name;
        // Find next slide with a DIFFERENT name
        let next = (prev + 1) % slides.length;
        let attempts = 0;
        while (slides[next].name === currentName && attempts < slides.length - 1) {
          next = (next + 1) % slides.length;
          attempts++;
        }
        onSlideChangeRef.current?.(slides[next].name);
        return next;
      });
    }, INTERVAL);

    return () => clearInterval(timer);
  }, []);

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
      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#151b23]/30" />
    </div>
  );
}
