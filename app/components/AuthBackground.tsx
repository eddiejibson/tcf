"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

const TOTAL_CORAL = 37;
const TOTAL_FISH = 22;
const INTERVAL = 5000;

const images: string[] = [];
let fishIdx = 0;
for (let i = 1; i <= TOTAL_CORAL; i++) {
  images.push(`/coral-images/${i}.jpg`);
  if (i % 2 === 0 && fishIdx < TOTAL_FISH) {
    fishIdx++;
    images.push(`/fish-images/${fishIdx}.jpg`);
  }
}

export default function AuthBackground() {
  const [currentIndex, setCurrentIndex] = useState(() => Math.floor(Math.random() * images.length));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 -z-10">
      {images.map((src, i) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${
            i === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={src}
            alt=""
            fill
            className="object-cover blur-[2px] scale-105"
            priority={i < 2}
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-[#1a1f26]/80" />
    </div>
  );
}
