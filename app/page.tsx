import Image from "next/image";
import Link from "next/link";
import AnimatedCounter from "./components/AnimatedCounter";
import BookAppointmentButton from "./components/BookAppointmentButton";
import BookingForm from "./components/BookingForm";
import { FadeIn, ScaleIn, SlideInLeft } from "./components/HeroAnimations";
import MobileHero from "./components/MobileHero";
import {
  BlurIn,
  Float,
  GlowUp,
  PulseGlow,
  StaggerChild,
  StaggerList,
  SwipeReveal,
} from "./components/ScrollAnimations";
import Slideshow from "./components/Slideshow";

export default function Home() {
  return (
    <div className="relative w-full bg-[#2B343E]">
      {/* ===== HERO SECTION ===== */}
      <section className="relative w-full min-h-screen md:min-h-0 md:h-[80vh] overflow-hidden">
        {/* Desktop: Right side slideshow - behind the wave */}
        <div className="absolute right-0 top-0 bottom-0 w-[60%] hidden md:block">
          <Slideshow />
        </div>

        {/* Desktop: Left side darker gray box with wave edge */}
        <div className="absolute left-0 top-0 bottom-0 w-[45%] bg-[#1a1f26] hidden md:block z-10">
          {/* Subtle animated orbs - kept away from right edge */}
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />

          {/* Floating particles */}
          <div className="hero-particle hero-particle-1" />
          <div className="hero-particle hero-particle-2" />
          <div className="hero-particle hero-particle-3" />
          <div className="hero-particle hero-particle-4" />
          <div className="hero-particle hero-particle-5" />
          <div className="hero-particle hero-particle-6" />
          <div className="hero-particle hero-particle-7" />
          <div className="hero-particle hero-particle-8" />

          {/* Layered wave effect - same shape, different sizes */}
          {/* Wave 3 - furthest back, lightest */}
          <svg
            className="absolute top-0 bottom-0 h-full -right-[149px] w-[150px]"
            viewBox="0 0 150 1440"
            preserveAspectRatio="none"
          >
            <path d="M0,0 Q150,360 75,720 T112,1440 L0,1440 Z" fill="#252b33" />
          </svg>

          {/* Wave 2 - middle layer */}
          <svg
            className="absolute top-0 bottom-0 h-full -right-[119px] w-[120px]"
            viewBox="0 0 120 1440"
            preserveAspectRatio="none"
          >
            <path d="M0,0 Q120,360 60,720 T90,1440 L0,1440 Z" fill="#1f252c" />
          </svg>

          {/* Wave 1 - front, darkest */}
          <svg
            className="absolute top-0 bottom-0 h-full -right-[79px] w-[80px]"
            viewBox="0 0 80 1440"
            preserveAspectRatio="none"
          >
            <path d="M0,0 Q80,360 40,720 T60,1440 L0,1440 Z" fill="#1a1f26" />
          </svg>
        </div>

        {/* Mobile Hero (includes content, slideshow, wave dividers, contact card) */}
        <MobileHero />

        {/* Desktop Content Container */}
        <div className="relative z-20 hidden md:flex flex-row items-start justify-between h-full px-8 lg:px-[100px] xl:px-[140px] pt-8 pb-12 gap-6 lg:gap-10">
          {/* Left Side Content */}
          <div className="flex-1 max-w-[500px] lg:max-w-[600px]">
            {/* Logo */}
            <FadeIn delay={0.1}>
              <div className="mb-5 w-[50px] h-[75px]">
                <Image
                  src="/images/logo.png"
                  alt="The Coral Farm"
                  width={50}
                  height={75}
                  style={{
                    filter: "drop-shadow(0px 3px 3px rgba(0, 0, 0, 0.161))",
                  }}
                />
              </div>
            </FadeIn>

            {/* Main Headline */}
            <div className="space-y-2 mt-[8vh] lg:mt-[10vh]">
              <SlideInLeft delay={0.2}>
                <h1 className="text-3xl lg:text-4xl xl:text-5xl leading-tight font-black text-white">
                  We love coral
                </h1>
              </SlideInLeft>
              <SlideInLeft delay={0.35}>
                <p
                  className="text-sm lg:text-base xl:text-lg leading-relaxed font-medium text-white"
                  style={{ opacity: 0.66, maxWidth: "400px" }}
                >
                  The UK&apos;s leading coral wholesaler. Premium livestock,
                  properly quarantined.
                </p>
              </SlideInLeft>
            </div>

            {/* Trade Badges */}
            <FadeIn delay={0.5}>
              <div className="flex items-center gap-4 lg:gap-6 mt-5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#0984E3]" />
                  <span className="text-white/60 text-xs lg:text-sm font-medium">
                    Trade Only
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#0984E3]" />
                  <span className="text-white/60 text-xs lg:text-sm font-medium">
                    Exclusive Suppliers
                  </span>
                </div>
              </div>
            </FadeIn>

            {/* CTA Buttons */}
            <FadeIn delay={0.65}>
              <div className="flex flex-row gap-2 lg:gap-3 mt-5">
                <Link
                  href="/gallery"
                  className="bg-[#0984E3] text-white font-bold text-xs lg:text-sm xl:text-base px-4 lg:px-6 py-2.5 lg:py-3 rounded-[12px] lg:rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-[#0770c4] hover:scale-105 active:scale-95 shadow-lg whitespace-nowrap inline-flex items-center justify-center leading-none"
                >
                  VIEW GALLERY
                </Link>
                <Link
                  href="#why-us"
                  className="bg-transparent border-2 border-white/80 text-white font-bold text-xs lg:text-sm xl:text-base px-4 lg:px-6 py-2.5 lg:py-3 rounded-[12px] lg:rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-white/10 hover:scale-105 active:scale-95 whitespace-nowrap inline-flex items-center justify-center leading-none"
                >
                  LEARN MORE
                </Link>
              </div>
            </FadeIn>
          </div>

          {/* Right Side - Contact Card */}
          <ScaleIn
            delay={0.4}
            className="w-[320px] lg:w-[400px] xl:w-[480px] self-center flex-shrink-0"
          >
            <div
              id="contact-card"
              className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[20px] lg:rounded-[28px] p-5 lg:p-8 xl:p-10 shadow-2xl"
            >
              <h3 className="text-xl lg:text-2xl xl:text-[28px] font-bold text-white mb-2">
                Let&apos;s talk
              </h3>
              <p
                className="text-base lg:text-lg font-normal text-white leading-relaxed mb-6"
                style={{ opacity: 0.8 }}
              >
                In the trade? Book an appointment to view our stock.
              </p>

              <BookingForm />
            </div>
          </ScaleIn>
        </div>
      </section>

      {/* ===== HERO TO CONTENT WAVE DIVIDER (Desktop) ===== */}
      <div className="hidden md:block relative h-20 -mt-20 z-30">
        <svg
          className="absolute bottom-0 w-full h-full"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
        >
          <path d="M0,80 Q360,0 720,40 T1440,20 L1440,80 Z" fill="#2B343E" />
        </svg>
      </div>

      {/* ===== OUR PROCESS SECTION ===== */}
      <section className="px-6 md:px-[100px] lg:px-[140px] -mt-6 md:mt-0 pt-0 md:pt-12 pb-16 md:pb-24 relative section-texture">
        <div className="max-w-6xl mx-auto">
          <BlurIn>
            <p className="text-[#0984E3] font-semibold text-sm tracking-widest uppercase mb-3">
              Our Process
            </p>
          </BlurIn>
          <GlowUp delay={0.1}>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 drop-shadow-[0_2px_15px_rgba(255,255,255,0.15)]">
              Quality you can trust
            </h2>
          </GlowUp>
          <BlurIn delay={0.2}>
            <p className="text-white/60 text-base md:text-lg max-w-2xl mb-12">
              Every piece of coral that leaves our facility has been through a
              rigorous process to ensure it arrives healthy and ready to thrive.
            </p>
          </BlurIn>

          <StaggerList className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Step 1 */}
            <StaggerChild>
              <div className="bg-[#1a1f26] rounded-[20px] p-6 md:p-8 border border-white/5 hover:border-[#0984E3]/30 transition-all duration-500 h-full shadow-[0_0_30px_rgba(9,132,227,0.15)] hover:shadow-[0_0_60px_rgba(9,132,227,0.4)] hover:-translate-y-2 hover:scale-[1.02]">
                <Float intensity={5}>
                  <div className="w-12 h-12 rounded-full bg-[#0984E3]/20 flex items-center justify-center mb-5">
                    <span className="text-[#0984E3] font-bold text-lg">01</span>
                  </div>
                </Float>
                <h3 className="text-xl font-bold text-white mb-3">
                  Source the best
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  We work directly with trusted collectors and mariculture
                  facilities worldwide to bring in only the finest fish and
                  coral. No middlemen, no compromises.
                </p>
              </div>
            </StaggerChild>

            {/* Step 2 */}
            <StaggerChild>
              <div className="bg-[#1a1f26] rounded-[20px] p-6 md:p-8 border border-white/5 hover:border-[#0984E3]/30 transition-all duration-500 h-full shadow-[0_0_30px_rgba(9,132,227,0.15)] hover:shadow-[0_0_60px_rgba(9,132,227,0.4)] hover:-translate-y-2 hover:scale-[1.02]">
                <Float intensity={5}>
                  <div className="w-12 h-12 rounded-full bg-[#0984E3]/20 flex items-center justify-center mb-5">
                    <span className="text-[#0984E3] font-bold text-lg">02</span>
                  </div>
                </Float>
                <h3 className="text-xl font-bold text-white mb-3">
                  Quarantine &amp; dip
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Every coral goes through our strict quarantine protocol. We
                  dip, treat with antibiotics, inspect and monitor before
                  anything hits the sales floor. Pests don&apos;t make it past
                  us.
                </p>
              </div>
            </StaggerChild>

            {/* Step 3 */}
            <StaggerChild>
              <div className="bg-[#1a1f26] rounded-[20px] p-6 md:p-8 border border-white/5 hover:border-[#0984E3]/30 transition-all duration-500 h-full shadow-[0_0_30px_rgba(9,132,227,0.15)] hover:shadow-[0_0_60px_rgba(9,132,227,0.4)] hover:-translate-y-2 hover:scale-[1.02]">
                <Float intensity={5}>
                  <div className="w-12 h-12 rounded-full bg-[#0984E3]/20 flex items-center justify-center mb-5">
                    <span className="text-[#0984E3] font-bold text-lg">03</span>
                  </div>
                </Float>
                <h3 className="text-xl font-bold text-white mb-3">
                  Condition &amp; thrive
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Our state-of-the-art holding systems ensure every coral is
                  properly conditioned, coloured up, and ready to be picked up
                  or shipped to directly to your shop.
                </p>
              </div>
            </StaggerChild>
          </StaggerList>
        </div>
      </section>

      {/* ===== SLANT DIVIDER: Process to Why Us ===== */}
      <div className="relative h-16 md:h-24 overflow-hidden divider-texture">
        <svg
          className="absolute w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polygon points="0,0 100,100 0,100" fill="#1a1f26" />
        </svg>
      </div>

      {/* ===== WHY US SECTION ===== */}
      <section
        id="why-us"
        className="px-6 md:px-[100px] lg:px-[140px] py-16 md:py-24 bg-[#1a1f26] section-texture"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <SwipeReveal direction="left">
                <p className="text-[#0984E3] font-semibold text-sm tracking-widest uppercase mb-3">
                  Why Choose Us
                </p>
              </SwipeReveal>
              <SwipeReveal direction="left" delay={0.1}>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                  Built for the trade
                </h2>
              </SwipeReveal>
              <SwipeReveal direction="left" delay={0.2}>
                <p className="text-white/60 text-base md:text-lg leading-relaxed mb-8">
                  We&apos;re not a retail shop trying to do wholesale on the
                  side. We&apos;re purpose-built for trade customers who need
                  reliable stock, competitive pricing, and a partner who
                  understands the business.
                </p>
              </SwipeReveal>

              <div className="space-y-4">
                <SwipeReveal direction="left" delay={0.3}>
                  <div className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-[#0984E3] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">
                        Wholesale only
                      </h4>
                      <p className="text-white/50 text-sm">
                        We don&apos;t compete with our customers. Trade accounts
                        only.
                      </p>
                    </div>
                  </div>
                </SwipeReveal>

                <SwipeReveal direction="left" delay={0.4}>
                  <div className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-[#0984E3] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">
                        Consistent availability
                      </h4>
                      <p className="text-white/50 text-sm">
                        Regular shipments mean you can rely on us week after
                        week.
                      </p>
                    </div>
                  </div>
                </SwipeReveal>

                <SwipeReveal direction="left" delay={0.5}>
                  <div className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-[#0984E3] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">
                        UK-based facility
                      </h4>
                      <p className="text-white/50 text-sm">
                        No import headaches. Stock is here, quarantined, and
                        ready to go.
                      </p>
                    </div>
                  </div>
                </SwipeReveal>
              </div>
            </div>

            {/* Stats */}
            <StaggerList className="grid grid-cols-2 gap-4">
              <StaggerChild>
                <PulseGlow className="rounded-[20px]">
                  <div className="bg-[#2B343E] rounded-[20px] p-6 text-center border border-white/5 hover:border-[#0984E3]/30 transition-all duration-300">
                    <p className="text-4xl md:text-5xl font-black text-white mb-2">
                      <AnimatedCounter end={20} suffix="+" />
                    </p>
                    <p className="text-white/50 text-sm">Years experience</p>
                  </div>
                </PulseGlow>
              </StaggerChild>
              <StaggerChild>
                <PulseGlow className="rounded-[20px]">
                  <div className="bg-[#2B343E] rounded-[20px] p-6 text-center border border-white/5 hover:border-[#0984E3]/30 transition-all duration-300">
                    <p className="text-4xl md:text-5xl font-black text-white mb-2">
                      <AnimatedCounter end={100} suffix="+" />
                    </p>
                    <p className="text-white/50 text-sm">Trade customers</p>
                  </div>
                </PulseGlow>
              </StaggerChild>
              <StaggerChild>
                <PulseGlow className="rounded-[20px]">
                  <div className="bg-[#2B343E] rounded-[20px] p-6 text-center border border-white/5 hover:border-[#0984E3]/30 transition-all duration-300">
                    <p className="text-4xl md:text-5xl font-black text-white mb-2">
                      <AnimatedCounter end={10} suffix="+" />
                    </p>
                    <p className="text-white/50 text-sm">Shipments monthly</p>
                  </div>
                </PulseGlow>
              </StaggerChild>
              <StaggerChild>
                <PulseGlow className="rounded-[20px]">
                  <div className="bg-[#2B343E] rounded-[20px] p-6 text-center border border-white/5 hover:border-[#0984E3]/30 transition-all duration-300">
                    <p className="text-4xl md:text-5xl font-black text-white mb-2">
                      <AnimatedCounter end={100} suffix="%" />
                    </p>
                    <p className="text-white/50 text-sm">Exclusive Suppliers</p>
                  </div>
                </PulseGlow>
              </StaggerChild>
            </StaggerList>
          </div>
        </div>
      </section>

      {/* ===== SLANT DIVIDER: Why Us to Team ===== */}
      <div className="relative h-16 md:h-24 overflow-hidden bg-[#1a1f26] divider-texture">
        <svg
          className="absolute w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polygon points="100,0 100,100 0,100" fill="#2B343E" />
        </svg>
      </div>

      {/* ===== OUR EXPERTISE SECTION ===== */}
      <section className="px-6 md:px-[100px] lg:px-[140px] py-16 md:py-24 section-texture">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <SwipeReveal>
              <p className="text-[#0984E3] font-semibold text-sm tracking-widest uppercase mb-3">
                Our Expertise
              </p>
            </SwipeReveal>
            <SwipeReveal delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                We&apos;ve been in your shoes
              </h2>
            </SwipeReveal>
            <SwipeReveal delay={0.2}>
              <p className="text-white/60 text-base md:text-lg max-w-2xl mx-auto">
                Our team has owned and operated successful marine retail shops.
                We know the struggles you face because we&apos;ve lived them.
              </p>
            </SwipeReveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Retail Experience */}
            <SwipeReveal delay={0.1}>
              <div className="group relative bg-gradient-to-b from-[#1a1f26] to-[#1a1f26]/80 rounded-[24px] p-8 border border-white/5 hover:border-[#0984E3]/30 transition-all duration-500 hover:-translate-y-1 h-full">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0984E3]/0 to-[#0984E3]/5 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0984E3]/20 to-[#0984E3]/10 flex items-center justify-center mb-6 border border-[#0984E3]/20">
                    <svg
                      className="w-8 h-8 text-[#0984E3]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    Retail Veterans
                  </h3>
                  <p className="text-white/50 text-sm leading-relaxed">
                    We&apos;ve owned and run some of the UK&apos;s most
                    successful marine shops. We got frustrated with inconsistent
                    supply and unreliable stock - so we built the solution
                    ourselves.
                  </p>
                </div>
              </div>
            </SwipeReveal>

            {/* Marine Biologist */}
            <SwipeReveal delay={0.2}>
              <div className="group relative bg-gradient-to-b from-[#1a1f26] to-[#1a1f26]/80 rounded-[24px] p-8 border border-white/5 hover:border-[#0984E3]/30 transition-all duration-500 hover:-translate-y-1 h-full">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0984E3]/0 to-[#0984E3]/5 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0984E3]/20 to-[#0984E3]/10 flex items-center justify-center mb-6 border border-[#0984E3]/20">
                    <svg
                      className="w-8 h-8 text-[#0984E3]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    Expert Selection
                  </h3>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Our marine biologist travels to exclusive global suppliers,
                    hand-picking only the healthiest specimens and negotiating
                    the best prices for you.
                  </p>
                </div>
              </div>
            </SwipeReveal>

            {/* Proper Quarantine */}
            <SwipeReveal delay={0.3}>
              <div className="group relative bg-gradient-to-b from-[#1a1f26] to-[#1a1f26]/80 rounded-[24px] p-8 border border-white/5 hover:border-[#0984E3]/30 transition-all duration-500 hover:-translate-y-1 h-full">
                <div className="absolute inset-0 bg-gradient-to-b from-[#0984E3]/0 to-[#0984E3]/5 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0984E3]/20 to-[#0984E3]/10 flex items-center justify-center mb-6 border border-[#0984E3]/20">
                    <svg
                      className="w-8 h-8 text-[#0984E3]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    No Chop Shop
                  </h3>
                  <p className="text-white/50 text-sm leading-relaxed">
                    We don&apos;t rush stock out the door. Every coral is
                    properly rested, quarantined, and given time to recover from
                    shipping stress before it ever reaches your shop.
                  </p>
                </div>
              </div>
            </SwipeReveal>
          </div>
        </div>
      </section>

      {/* ===== SLANT DIVIDER: Team to CTA ===== */}
      <div className="relative h-16 md:h-24 overflow-hidden divider-texture">
        <svg
          className="absolute w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polygon points="0,0 100,100 0,100" fill="#1a1f26" />
        </svg>
      </div>

      {/* ===== CTA SECTION ===== */}
      <section className="px-6 md:px-[100px] lg:px-[140px] py-16 md:py-24 bg-[#1a1f26]">
        <div className="max-w-4xl mx-auto text-center">
          <SwipeReveal>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to stock up?
            </h2>
          </SwipeReveal>
          <SwipeReveal delay={0.1}>
            <p className="text-white/60 text-base md:text-lg mb-8 max-w-xl mx-auto">
              Get in touch to arrange a viewing. We&apos;d love to show you
              around our facility and discuss how we can support your business.
            </p>
          </SwipeReveal>
          <SwipeReveal delay={0.2}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <BookAppointmentButton className="bg-[#0984E3] text-white font-bold text-base px-8 py-4 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-[#0770c4] hover:scale-105 active:scale-95 shadow-lg">
                BOOK AN APPOINTMENT
              </BookAppointmentButton>
              <Link
                href="/gallery"
                className="bg-transparent border-2 border-white/40 text-white font-bold text-base px-8 py-4 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-white/10 hover:border-white/60 hover:scale-105 active:scale-95"
              >
                VIEW OUR STOCK
              </Link>
            </div>
          </SwipeReveal>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="px-6 md:px-[100px] lg:px-[140px] py-12 bg-[#1a1f26] border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <SwipeReveal>
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                <Image
                  src="/images/logo.png"
                  alt="The Coral Farm"
                  width={40}
                  height={60}
                />
                <span className="text-white font-bold tracking-wider">
                  THE CORAL FARM
                </span>
              </div>
              <p className="text-white/40 text-sm">
                &copy; {new Date().getFullYear()} The Coral Farm. All rights
                reserved.
              </p>
            </div>
          </SwipeReveal>
        </div>
      </footer>
    </div>
  );
}
