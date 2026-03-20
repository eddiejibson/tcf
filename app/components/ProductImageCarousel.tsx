"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSwipeable } from "react-swipeable";

interface CarouselImage {
  id: string;
  imageUrl: string;
  label: string | null;
  sortOrder: number;
}

interface Props {
  images: CarouselImage[];
  alt: string;
  className?: string;
}

export default function ProductImageCarousel({ images, alt, className = "" }: Props) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseRef = useRef(false);

  const count = images.length;

  const startTimer = useCallback(() => {
    if (count <= 1) return;
    timerRef.current = setTimeout(() => {
      if (!pauseRef.current) {
        setCurrent((prev) => (prev + 1) % count);
      }
      startTimer();
    }, 4000);
  }, [count]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTimer]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    pauseRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => {
      pauseRef.current = false;
      startTimer();
    }, 8000);
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => count > 1 && goTo((current + 1) % count),
    onSwipedRight: () => count > 1 && goTo((current - 1 + count) % count),
    trackMouse: false,
    preventScrollOnSwipe: true,
  });

  // 0 images — placeholder
  if (count === 0) {
    return (
      <div className={`w-full h-full flex items-center justify-center text-white/10 ${className}`}>
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    );
  }

  // 1 image — static
  if (count === 1) {
    return (
      <div className={`w-full h-full relative ${className}`}>
        <img src={images[0].imageUrl} alt={alt} className="w-full h-full object-cover" />
        {images[0].label && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full">
            <span className="text-white text-[11px] font-medium">{images[0].label}</span>
          </div>
        )}
      </div>
    );
  }

  // 2+ images — carousel
  return (
    <div {...handlers} className={`w-full h-full relative select-none ${className}`}>
      {images.map((img, i) => (
        <img
          key={img.id}
          src={img.imageUrl}
          alt={`${alt} ${i + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Label */}
      {images[current]?.label && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full z-[1]">
          <span className="text-white text-[11px] font-medium">{images[current].label}</span>
        </div>
      )}

      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-[1]">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); goTo(i); }}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              i === current ? "bg-white w-3" : "bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
