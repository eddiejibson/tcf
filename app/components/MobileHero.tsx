"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import BookingForm from "./BookingForm";
import Slideshow from "./Slideshow";

const CORAL_NAMES = [
  "Acropora",
  "Euphyllia",
  "Zoanthids",
  "Goniopora",
  "Chalice",
  "Montipora",
  "Torch",
  "Hammers",
  "Acans",
  "Blastomussa",
];

export default function MobileHero() {
  const [showContact, setShowContact] = useState(false);
  const [coralIndex, setCoralIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCoralIndex((prev) => (prev + 1) % CORAL_NAMES.length);
        setIsAnimating(false);
      }, 300);
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  // Listen for custom event to open contact form
  useEffect(() => {
    const handleOpenContact = () => {
      setShowContact(true);
    };

    window.addEventListener("openMobileContact", handleOpenContact);
    return () => {
      window.removeEventListener("openMobileContact", handleOpenContact);
    };
  }, []);

  return (
    <div id="mobile-hero" className="relative md:hidden w-full">
      {/* Mobile: Dark gray box with content */}
      <div className="relative w-full bg-[#1a1f26] overflow-hidden">
        {/* Animated orbs and particles - inside dark section */}
        <div className="absolute inset-0 z-[1] pointer-events-none">
          <div className="hero-orb-mobile hero-orb-mobile-1" />
          <div className="hero-orb-mobile hero-orb-mobile-2" />
          <div className="hero-particle-mobile hero-particle-mobile-1" />
          <div className="hero-particle-mobile hero-particle-mobile-2" />
          <div className="hero-particle-mobile hero-particle-mobile-3" />
          <div className="hero-particle-mobile hero-particle-mobile-4" />
          <div className="hero-particle-mobile hero-particle-mobile-5" />
          <div className="hero-particle-mobile hero-particle-mobile-6" />
        </div>

        <div className="relative z-10 px-6 py-8 pb-4 text-center">
          {/* Logo */}
          <div className="mb-6 w-[40px] h-[60px] mx-auto">
            <Image
              src="/images/logo.png"
              alt="The Coral Farm"
              width={40}
              height={60}
              style={{
                filter: "drop-shadow(0px 3px 3px rgba(0, 0, 0, 0.161))",
              }}
            />
          </div>

          {/* Main Headline */}
          <div className="space-y-2">
            <h1 className="text-4xl leading-tight font-black text-white">
              We love coral
            </h1>
            <p
              className="text-base leading-relaxed font-medium text-white"
              style={{ opacity: 0.66 }}
            >
              The UK&apos;s leading coral wholesaler
            </p>
          </div>

          {/* Trade Badge */}
          <div className="flex items-center justify-center gap-4 mt-5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#0984E3]" />
              <span className="text-white/60 text-sm font-medium">
                Trade Only
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#0984E3]" />
              <span className="text-white/60 text-sm font-medium">
                Exclusive Suppliers
              </span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-row gap-3 mt-5 justify-center">
            <button className="bg-[#0984E3] text-white font-bold text-sm px-5 py-3 !mb-0 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-[#0770c4] hover:scale-105 active:scale-95 shadow-lg">
              VIEW GALLERY
            </button>
            <button
              onClick={() => setShowContact(true)}
              className="bg-transparent border-2 border-white/80 text-white font-bold text-sm px-5 py-3 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-white/10 hover:scale-105 active:scale-95"
            >
              CONTACT US
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: Slideshow with diagonal wave overlay */}
      <div className="relative w-full h-[520px]">
        <Slideshow />
        {/* Diagonal wave overlay at top - angled to show more image */}
        <svg
          className="absolute top-0 left-0 w-full h-[120px] z-10"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,0 L0,100 Q360,50 720,70 T1440,25 L1440,0 Z"
            fill="#1a1f26"
          />
        </svg>

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-black/25 z-[5] pointer-events-none" />

        {/* Animated coral names overlay */}
        {!showContact && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="text-center">
              <p className="text-xs font-semibold text-white/80 uppercase tracking-[0.25em] mb-3 drop-shadow-lg">
                We source the best
              </p>
              <div className="h-[55px]">
                <p
                  className={`text-4xl font-black text-white transition-all duration-500 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] ${
                    isAnimating
                      ? "opacity-0 blur-sm scale-95"
                      : "opacity-100 blur-0 scale-100"
                  }`}
                >
                  {CORAL_NAMES[coralIndex]}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contact Card Overlay */}
        {showContact && (
          <div className="absolute inset-x-4 top-[40px] z-40">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[24px] shadow-2xl relative max-h-[480px] overflow-y-auto">
              {/* Close button */}
              <button
                onClick={() => setShowContact(false)}
                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors cursor-pointer z-10"
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

              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-2">
                  Let&apos;s talk
                </h3>
                <p className="text-sm font-normal text-white/80 leading-relaxed mb-5">
                  In the trade? Book an appointment to view our stock.
                </p>
                <BookingForm compact />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wave divider at bottom - overlays bottom of slideshow */}
      <div className="relative h-[80px] -mt-[80px] z-30">
        <svg
          className="absolute bottom-0 w-full h-full"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
        >
          <path d="M0,80 Q360,0 720,40 T1440,20 L1440,80 Z" fill="#2B343E" />
        </svg>
      </div>
    </div>
  );
}
