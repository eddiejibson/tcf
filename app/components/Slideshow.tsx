"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

const TOTAL_IMAGES = 37;
const INTERVAL = 4000; // 4 seconds per image

export default function Slideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % TOTAL_IMAGES);
    }, INTERVAL);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {Array.from({ length: TOTAL_IMAGES }, (_, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={`/coral-images/${i + 1}.jpg`}
            alt={`Coral ${i + 1}`}
            fill
            className="object-cover"
            priority={i < 3}
          />
        </div>
      ))}
      {/* Gradient overlay for better text contrast if needed */}
      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#2B343E]/30" />
    </div>
  );
}
