"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const totalImages = 37;
const images = Array.from(
  { length: totalImages },
  (_, i) => `/coral-images/${i + 1}.jpg`
);

export default function Gallery() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance slideshow
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalImages);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % totalImages);
    setIsAutoPlaying(false);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + totalImages) % totalImages);
    setIsAutoPlaying(false);
  }, []);

  const openLightbox = (index: number) => {
    setLightboxImage(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextLightbox = useCallback(() => {
    setLightboxImage((prev) => (prev + 1) % totalImages);
  }, []);

  const prevLightbox = useCallback(() => {
    setLightboxImage((prev) => (prev - 1 + totalImages) % totalImages);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxOpen) {
        if (e.key === "ArrowRight") nextLightbox();
        if (e.key === "ArrowLeft") prevLightbox();
        if (e.key === "Escape") closeLightbox();
      } else {
        if (e.key === "ArrowRight") nextSlide();
        if (e.key === "ArrowLeft") prevSlide();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, nextSlide, prevSlide, nextLightbox, prevLightbox]);

  return (
    <div className="min-h-screen bg-[#1a1f26]">
      {/* Header */}
      <header className="px-6 md:px-[100px] lg:px-[140px] py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/images/logo.png"
            alt="The Coral Farm"
            width={40}
            height={60}
            className="transition-transform duration-300 group-hover:scale-105"
          />
          <span className="text-white font-extrabold tracking-wider hidden sm:block">
            THE CORAL FARM
          </span>
        </Link>
        <Link
          href="/"
          className="text-white/60 hover:text-white transition-colors duration-200 text-sm font-medium"
        >
          Back to Home
        </Link>
      </header>

      {/* Hero Slideshow */}
      <section className="px-6 md:px-[100px] lg:px-[140px] pt-4 pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Slideshow Container */}
          <div className="relative aspect-[4/3] md:aspect-[4/3] lg:aspect-[16/10] rounded-[24px] overflow-hidden group">
            {/* Images */}
            {images.map((src, index) => (
              <div
                key={src}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  index === currentSlide ? "opacity-100" : "opacity-0"
                }`}
              >
                <Image
                  src={src}
                  alt={`Coral ${index + 1}`}
                  fill
                  className="object-cover object-center"
                  priority={index === 0}
                />
              </div>
            ))}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

            {/* Glass Controls */}
            <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
              <div className="flex items-center justify-between">
                {/* Left Arrow */}
                <button
                  onClick={prevSlide}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white cursor-pointer transition-all duration-300 hover:bg-white/20 hover:scale-110 active:scale-95 shadow-lg"
                >
                  <svg
                    className="w-5 h-5 md:w-6 md:h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                {/* Center Controls */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-4 md:px-6 py-2 md:py-3 flex items-center gap-3 md:gap-4 shadow-lg">
                  {/* Play/Pause */}
                  <button
                    onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 flex items-center justify-center text-white cursor-pointer transition-all duration-200 hover:bg-white/20"
                  >
                    {isAutoPlaying ? (
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4 ml-0.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Counter */}
                  <span className="text-white font-medium text-sm md:text-base tabular-nums">
                    {String(currentSlide + 1).padStart(2, "0")} / {totalImages}
                  </span>

                  {/* Progress Dots (show subset) */}
                  <div className="hidden md:flex items-center gap-1.5">
                    {Array.from({ length: 5 }, (_, i) => {
                      const dotIndex =
                        (Math.floor(currentSlide / (totalImages / 5)) *
                          (totalImages / 5)) /
                          (totalImages / 5) +
                        i;
                      const isActive =
                        Math.floor(currentSlide / (totalImages / 5)) === i;
                      return (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            isActive ? "w-6 bg-white" : "w-1.5 bg-white/40"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Right Arrow */}
                <button
                  onClick={nextSlide}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white cursor-pointer transition-all duration-300 hover:bg-white/20 hover:scale-110 active:scale-95 shadow-lg"
                >
                  <svg
                    className="w-5 h-5 md:w-6 md:h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Click to view full */}
            <button
              onClick={() => openLightbox(currentSlide)}
              className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white cursor-pointer transition-all duration-300 hover:bg-white/20 hover:scale-110 opacity-0 group-hover:opacity-100"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="px-6 md:px-[100px] lg:px-[140px] pb-16 md:pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                All Stock Photos
              </h2>
              <p className="text-white/50 text-sm md:text-base">
                Click any image to view full size
              </p>
            </div>
            <span className="text-white/40 text-sm">{totalImages} photos</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {images.map((src, index) => (
              <button
                key={src}
                onClick={() => openLightbox(index)}
                className="group relative aspect-square rounded-[16px] overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#0984E3]/20"
              >
                <Image
                  src={src}
                  alt={`Coral ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                {/* Index Badge */}
                <div className="absolute bottom-2 left-2 bg-white/10 backdrop-blur-md rounded-full px-2.5 py-1 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  #{index + 1}
                </div>
                {/* Expand Icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                      />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 md:top-8 md:right-8 w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white cursor-pointer transition-all duration-300 hover:bg-white/20 hover:scale-110 z-10"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Image Container */}
          <div
            className="relative w-full h-full max-w-[90vw] max-h-[85vh] m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[lightboxImage]}
              alt={`Coral ${lightboxImage + 1}`}
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevLightbox();
            }}
            className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white cursor-pointer transition-all duration-300 hover:bg-white/20 hover:scale-110"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              nextLightbox();
            }}
            className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white cursor-pointer transition-all duration-300 hover:bg-white/20 hover:scale-110"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          {/* Bottom Info Bar */}
          <div className="absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-6 py-3 flex items-center gap-4 shadow-lg">
            <span className="text-white font-medium tabular-nums">
              {String(lightboxImage + 1).padStart(2, "0")} / {totalImages}
            </span>
            <div className="w-px h-4 bg-white/20" />
            <span className="text-white/60 text-sm">
              Use arrow keys to navigate
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
