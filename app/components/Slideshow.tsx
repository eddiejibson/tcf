"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

const TOTAL_CORAL = 37;
const TOTAL_FISH = 22;
const INTERVAL = 4000; // 4 seconds per image

// Create mixed slideshow: coral images with fish images interspersed
const images: { src: string; alt: string }[] = [];
let fishIndex = 0;
for (let i = 1; i <= TOTAL_CORAL; i++) {
  images.push({ src: `/coral-images/${i}.jpg`, alt: `Coral ${i}` });
  // Add a fish image every 2 coral images
  if (i % 2 === 0 && fishIndex < TOTAL_FISH) {
    fishIndex++;
    images.push({ src: `/fish-images/${fishIndex}.jpg`, alt: `Fish ${fishIndex}` });
  }
}

export default function Slideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, INTERVAL);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {images.map((img, i) => (
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
      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#2B343E]/30" />
    </div>
  );
}
