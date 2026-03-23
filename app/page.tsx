import Image from "next/image";
import Link from "next/link";
import AnimatedCounter from "./components/AnimatedCounter";
import BookAppointmentButton from "./components/BookAppointmentButton";
import BookingForm from "./components/BookingForm";
import BubbleParticles from "./components/BubbleParticles";
import GradientBorder from "./components/GradientBorder";
import { FadeIn, ScaleIn, SlideInLeft } from "./components/HeroAnimations";
import InfiniteMarquee from "./components/InfiniteMarquee";
import MagneticButton from "./components/MagneticButton";
import MeshGradient from "./components/MeshGradient";
import MobileHero from "./components/MobileHero";
import {
  BlurIn,
  Float,
  GlowUp,
  StaggerChild,
  StaggerList,
  SwipeReveal,
} from "./components/ScrollAnimations";
import ScrollVelocityText from "./components/ScrollVelocityText";
import Slideshow from "./components/Slideshow";
import SourceMap from "./components/SourceMap";
import SpotlightCursor from "./components/SpotlightCursor";
import TextScramble from "./components/TextScramble";
import TiltCard from "./components/TiltCard";

export default function Home() {
  return (
    <div className="relative w-full bg-[#151b23]">
      <SpotlightCursor />
      {/* ===== HERO SECTION ===== */}
      <section className="relative w-full md:h-[80vh] overflow-hidden">
        {/* Desktop: Right side slideshow - behind the wave */}
        <div className="absolute right-0 top-0 bottom-0 w-[60%] hidden md:block">
          <Slideshow />
        </div>

        {/* Desktop: Left side darker gray box with wave edge */}
        <div className="absolute left-0 top-0 bottom-0 w-[45%] bg-[#0d1219] hidden md:block z-10">
          {/* Animated mesh gradient */}
          <MeshGradient />

          {/* Underwater bubble particles */}
          <BubbleParticles />

          {/* Layered wave effect - same shape, different sizes */}
          {/* Wave 3 - furthest back, lightest */}
          <svg
            className="absolute top-0 bottom-0 h-full -right-[149px] w-[150px]"
            viewBox="0 0 150 1440"
            preserveAspectRatio="none"
          >
            <path d="M0,0 Q150,360 75,720 T112,1440 L0,1440 Z" fill="#101a24" />
          </svg>

          {/* Wave 2 - middle layer */}
          <svg
            className="absolute top-0 bottom-0 h-full -right-[119px] w-[120px]"
            viewBox="0 0 120 1440"
            preserveAspectRatio="none"
          >
            <path d="M0,0 Q120,360 60,720 T90,1440 L0,1440 Z" fill="#0e151e" />
          </svg>

          {/* Wave 1 - front, darkest */}
          <svg
            className="absolute top-0 bottom-0 h-full -right-[79px] w-[80px]"
            viewBox="0 0 80 1440"
            preserveAspectRatio="none"
          >
            <path d="M0,0 Q80,360 40,720 T60,1440 L0,1440 Z" fill="#0d1219" />
          </svg>
        </div>

        {/* Mobile Hero (includes content, slideshow, wave dividers, contact card) */}
        <MobileHero />

        {/* Trade Login - Desktop */}
        <div className="absolute top-6 right-8 lg:right-[100px] xl:right-[140px] z-30 hidden md:block">
          <FadeIn delay={0.8}>
            <Link
              href="/login"
              className="group flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/15 rounded-full text-white/70 text-sm font-medium transition-all duration-300 hover:bg-white/10 hover:border-white/25 hover:text-white"
            >
              <svg className="w-4 h-4 text-[#0984E3] transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Trade Login
            </Link>
          </FadeIn>
        </div>

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
                  <TextScramble text="We love coral" />
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
                <MagneticButton>
                  <Link
                    href="/gallery"
                    className="bg-[#0984E3] text-white font-bold text-xs lg:text-sm xl:text-base px-4 lg:px-6 py-2.5 lg:py-3 rounded-[12px] lg:rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-[#0770c4] hover:scale-105 active:scale-95 shadow-lg whitespace-nowrap inline-flex items-center justify-center leading-none"
                  >
                    VIEW GALLERY
                  </Link>
                </MagneticButton>
                {/* Mobile fallback for non-magnetic */}
                <Link
                  href="/gallery"
                  className="md:hidden bg-[#0984E3] text-white font-bold text-xs px-4 py-2.5 rounded-[12px] cursor-pointer transition-all duration-200 hover:bg-[#0770c4] active:scale-95 shadow-lg whitespace-nowrap inline-flex items-center justify-center leading-none"
                >
                  VIEW GALLERY
                </Link>
                <MagneticButton>
                  <Link
                    href="#why-us"
                    className="bg-transparent border-2 border-white/80 text-white font-bold text-xs lg:text-sm xl:text-base px-4 lg:px-6 py-2.5 lg:py-3 rounded-[12px] lg:rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-white/10 hover:scale-105 active:scale-95 whitespace-nowrap inline-flex items-center justify-center leading-none"
                  >
                    LEARN MORE
                  </Link>
                </MagneticButton>
                <Link
                  href="#why-us"
                  className="md:hidden bg-transparent border-2 border-white/80 text-white font-bold text-xs px-4 py-2.5 rounded-[12px] cursor-pointer transition-all duration-200 hover:bg-white/10 active:scale-95 whitespace-nowrap inline-flex items-center justify-center leading-none"
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
            <GradientBorder rounded="rounded-[20px] lg:rounded-[28px]">
            <div
              id="contact-card"
              className="bg-white/10 backdrop-blur-xl rounded-[20px] lg:rounded-[28px] p-5 lg:p-8 xl:p-10 shadow-2xl"
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
            </GradientBorder>
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
          <path d="M0,80 Q360,0 720,40 T1440,20 L1440,80 Z" fill="#151b23" />
        </svg>
      </div>

      {/* ===== MARQUEE TICKER ===== */}
      <div className="border-y border-white/[0.04]">
        <InfiniteMarquee
          items={[
            "Indonesia",
            "Australia",
            "Fiji",
            "Tonga",
            "Kenya",
            "Sri Lanka",
            "20+ Years Experience",
            "100+ Trade Customers",
            "10+ Monthly Shipments",
            "Exclusive Suppliers",
          ]}
        />
      </div>

      {/* ===== OUR PROCESS SECTION ===== */}
      <section className="px-6 md:px-[100px] lg:px-[140px] -mt-6 md:mt-0 py-16 md:py-28 relative">
        <div className="max-w-6xl mx-auto">
          <BlurIn>
            <p className="text-[#0984E3] font-semibold text-sm tracking-widest uppercase mb-3">
              Our Process
            </p>
          </BlurIn>
          <GlowUp delay={0.1}>
            <ScrollVelocityText>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Quality you can trust
              </h2>
            </ScrollVelocityText>
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
              <TiltCard className="h-full">
                <div className="bg-[#1a1f26] rounded-[20px] p-6 md:p-8 border border-white/5 hover:border-white/10 transition-all duration-300 h-full">
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
              </TiltCard>
            </StaggerChild>

            {/* Step 2 */}
            <StaggerChild>
              <TiltCard className="h-full">
                <div className="bg-[#1a1f26] rounded-[20px] p-6 md:p-8 border border-white/5 hover:border-white/10 transition-all duration-300 h-full">
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
                    anything is sold.
                  </p>
                </div>
              </TiltCard>
            </StaggerChild>

            {/* Step 3 */}
            <StaggerChild>
              <TiltCard className="h-full">
                <div className="bg-[#1a1f26] rounded-[20px] p-6 md:p-8 border border-white/5 hover:border-white/10 transition-all duration-300 h-full">
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
                    properly rested and ready to go into your customer&apos;s
                    tanks.
                  </p>
                </div>
              </TiltCard>
            </StaggerChild>
          </StaggerList>
        </div>
      </section>

      {/* Subtle divider */}
      <div className="px-6 md:px-[100px] lg:px-[140px]">
        <div className="max-w-6xl mx-auto h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ===== WHY US SECTION ===== */}
      <section
        id="why-us"
        className="px-6 md:px-[100px] lg:px-[140px] py-16 md:py-28"
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
                <ScrollVelocityText>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                    Built for the trade
                  </h2>
                </ScrollVelocityText>
              </SwipeReveal>
              <SwipeReveal direction="left" delay={0.2}>
                <p className="text-white/60 text-base md:text-lg leading-relaxed mb-8">
                  Purpose-built for trade customers who need reliable stock,
                  competitive pricing, and a partner who understands the
                  business.
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
                        Dedicated exclusively to trade accounts.
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
                <TiltCard>
                  <div className="bg-[#1a1f26] rounded-[20px] p-6 text-center border border-white/5 hover:border-white/10 transition-all duration-300">
                    <p className="text-4xl md:text-5xl font-black text-white mb-2">
                      <AnimatedCounter end={20} suffix="+" />
                    </p>
                    <p className="text-white/50 text-sm">Years experience</p>
                  </div>
                </TiltCard>
              </StaggerChild>
              <StaggerChild>
                <TiltCard>
                  <div className="bg-[#1a1f26] rounded-[20px] p-6 text-center border border-white/5 hover:border-white/10 transition-all duration-300">
                    <p className="text-4xl md:text-5xl font-black text-white mb-2">
                      <AnimatedCounter end={100} suffix="+" />
                    </p>
                    <p className="text-white/50 text-sm">Trade customers</p>
                  </div>
                </TiltCard>
              </StaggerChild>
              <StaggerChild>
                <TiltCard>
                  <div className="bg-[#1a1f26] rounded-[20px] p-6 text-center border border-white/5 hover:border-white/10 transition-all duration-300">
                    <p className="text-4xl md:text-5xl font-black text-white mb-2">
                      <AnimatedCounter end={10} suffix="+" />
                    </p>
                    <p className="text-white/50 text-sm">Shipments monthly</p>
                  </div>
                </TiltCard>
              </StaggerChild>
              <StaggerChild>
                <TiltCard>
                  <div className="bg-[#1a1f26] rounded-[20px] p-6 text-center border border-white/5 hover:border-white/10 transition-all duration-300">
                    <p className="text-4xl md:text-5xl font-black text-white mb-2">
                      <AnimatedCounter end={100} suffix="%" />
                    </p>
                    <p className="text-white/50 text-sm">Exclusive Suppliers</p>
                  </div>
                </TiltCard>
              </StaggerChild>
            </StaggerList>
          </div>
        </div>
      </section>

      {/* Subtle divider */}
      <div className="px-6 md:px-[100px] lg:px-[140px]">
        <div className="max-w-6xl mx-auto h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ===== OUR EXPERTISE SECTION ===== */}
      <section className="px-6 md:px-[100px] lg:px-[140px] py-16 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <SwipeReveal>
              <p className="text-[#0984E3] font-semibold text-sm tracking-widest uppercase mb-3">
                Our Expertise
              </p>
            </SwipeReveal>
            <SwipeReveal delay={0.1}>
              <ScrollVelocityText>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  We&apos;ve been in your shoes
                </h2>
              </ScrollVelocityText>
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
              <TiltCard className="h-full">
                <div className="bg-[#1a1f26] rounded-[20px] p-8 border border-white/5 hover:border-white/10 transition-all duration-300 h-full">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-[#0984E3]/10 flex items-center justify-center mb-6">
                      <svg
                        className="w-6 h-6 text-[#0984E3]"
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
                      We got frustrated with inconsistent supply and unreliable
                      stock - so we built the solution ourselves.
                    </p>
                  </div>
                </div>
              </TiltCard>
            </SwipeReveal>

            {/* Marine Biologist */}
            <SwipeReveal delay={0.2}>
              <TiltCard className="h-full">
                <div className="bg-[#1a1f26] rounded-[20px] p-8 border border-white/5 hover:border-white/10 transition-all duration-300 h-full">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-[#0984E3]/10 flex items-center justify-center mb-6">
                      <svg
                        className="w-6 h-6 text-[#0984E3]"
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
              </TiltCard>
            </SwipeReveal>

            {/* Proper Quarantine */}
            <SwipeReveal delay={0.3}>
              <TiltCard className="h-full">
                <div className="bg-[#1a1f26] rounded-[20px] p-8 border border-white/5 hover:border-white/10 transition-all duration-300 h-full">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[#0984E3]/10 flex items-center justify-center mb-6">
                    <svg
                      className="w-6 h-6 text-[#0984E3]"
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
                    Sustainable Practices
                  </h3>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Our rarest specimens are selected for aquaculture. This
                    ensures a sustainable future and lineage security.
                  </p>
                </div>
              </div>
              </TiltCard>
            </SwipeReveal>
          </div>
        </div>
      </section>

      {/* Subtle divider */}
      <div className="px-6 md:px-[100px] lg:px-[140px]">
        <div className="max-w-6xl mx-auto h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ===== WHERE WE SOURCE SECTION ===== */}
      <section className="px-6 md:px-[100px] lg:px-[140px] py-16 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <SwipeReveal>
              <p className="text-[#0984E3] font-semibold text-sm tracking-widest uppercase mb-3">
                Global Sourcing
              </p>
            </SwipeReveal>
            <SwipeReveal delay={0.1}>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Where we source
              </h2>
            </SwipeReveal>
            <SwipeReveal delay={0.2}>
              <p className="text-white/60 text-base md:text-lg max-w-2xl mx-auto">
                Our marine biologist travels to six exclusive regions worldwide,
                hand-selecting only the healthiest and most vibrant specimens.
              </p>
            </SwipeReveal>
          </div>
          <SwipeReveal delay={0.3}>
            <SourceMap />
          </SwipeReveal>
        </div>
      </section>

      {/* Subtle divider */}
      <div className="px-6 md:px-[100px] lg:px-[140px]">
        <div className="max-w-6xl mx-auto h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ===== JOIN THE FAMILY SECTION ===== */}
      <section className="relative px-6 md:px-[100px] lg:px-[140px] py-16 md:py-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#0984E3]/[0.03] rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <SwipeReveal direction="left">
                <p className="text-[#0984E3] font-semibold text-sm tracking-widest uppercase mb-3">
                  Trade Accounts
                </p>
              </SwipeReveal>
              <SwipeReveal direction="left" delay={0.1}>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Join the family
                </h2>
              </SwipeReveal>
              <SwipeReveal direction="left" delay={0.2}>
                <p className="text-white/60 text-base md:text-lg leading-relaxed mb-8">
                  Apply for a trade account and get access to our full range of premium coral and marine livestock at wholesale prices. Quick application, fast approval.
                </p>
              </SwipeReveal>
              <SwipeReveal direction="left" delay={0.3}>
                <Link
                  href="/apply"
                  className="inline-flex items-center gap-2 bg-[#0984E3] text-white font-bold text-base px-8 py-4 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-[#0770c4] hover:scale-105 active:scale-95 shadow-lg"
                >
                  APPLY FOR TRADE ACCOUNT
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </SwipeReveal>
            </div>

            <SwipeReveal delay={0.2}>
              <div className="bg-[#1a1f26] rounded-[20px] p-8 border border-white/5">
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#0984E3]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#0984E3] font-bold text-sm">1</span>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">Apply online</h4>
                      <p className="text-white/50 text-sm">Fill in your company details and submit your application.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#0984E3]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#0984E3] font-bold text-sm">2</span>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">We review</h4>
                      <p className="text-white/50 text-sm">Our team will review your application and get back to you quickly.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#0984E3]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#0984E3] font-bold text-sm">3</span>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">Start ordering</h4>
                      <p className="text-white/50 text-sm">Once approved, you can browse and order from our full range.</p>
                    </div>
                  </div>
                </div>
              </div>
            </SwipeReveal>
          </div>
        </div>
      </section>

      {/* Subtle divider */}
      <div className="px-6 md:px-[100px] lg:px-[140px]">
        <div className="max-w-6xl mx-auto h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* ===== CTA SECTION ===== */}
      <section className="relative px-6 md:px-[100px] lg:px-[140px] py-20 md:py-32 overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#0984E3]/[0.04] rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
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
              <MagneticButton>
                <BookAppointmentButton className="bg-[#0984E3] text-white font-bold text-base px-8 py-4 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-[#0770c4] hover:scale-105 active:scale-95">
                  BOOK AN APPOINTMENT
                </BookAppointmentButton>
              </MagneticButton>
              <BookAppointmentButton className="md:hidden bg-[#0984E3] text-white font-bold text-base px-8 py-4 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-[#0770c4] active:scale-95">
                BOOK AN APPOINTMENT
              </BookAppointmentButton>
              <MagneticButton>
                <Link
                  href="/gallery"
                  className="bg-transparent border-2 border-white/40 text-white font-bold text-base px-8 py-4 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-white/10 hover:border-white/60 hover:scale-105 active:scale-95"
                >
                  VIEW OUR STOCK
                </Link>
              </MagneticButton>
              <Link
                href="/gallery"
                className="md:hidden bg-transparent border-2 border-white/40 text-white font-bold text-base px-8 py-4 rounded-[14px] cursor-pointer transition-all duration-200 hover:bg-white/10 hover:border-white/60 active:scale-95"
              >
                VIEW OUR STOCK
              </Link>
            </div>
          </SwipeReveal>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="px-6 md:px-[100px] lg:px-[140px] py-12 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-10">
            {/* Brand */}
            <div className="flex flex-col gap-4">
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
              <p className="text-white/40 text-sm max-w-[280px]">
                The UK&apos;s leading coral wholesaler. Premium livestock, properly quarantined.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">Quick Links</h4>
              <div className="flex flex-col gap-2">
                <Link href="/gallery" className="text-white/40 text-sm hover:text-white/70 transition-colors">Gallery</Link>
                <Link href="/apply" className="text-white/40 text-sm hover:text-white/70 transition-colors">Apply for Account</Link>
                <Link href="/login" className="text-white/40 text-sm hover:text-white/70 transition-colors">Trade Login</Link>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">Get in Touch</h4>
              <div className="flex flex-col gap-2">
                <span className="text-white/40 text-sm">info@thecoralfarm.co.uk</span>
                <span className="text-white/40 text-sm">United Kingdom</span>
              </div>
            </div>

            {/* Social */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-3">Follow Us</h4>
              <a href="https://instagram.com/thecoralfarmltd" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
                <span className="text-sm">@thecoralfarmltd</span>
              </a>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/30 text-xs">
              &copy; {new Date().getFullYear()} The Coral Farm. All rights reserved.
            </p>
            <p className="text-white/20 text-xs">
              Trade wholesale only. Not open to the public.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
