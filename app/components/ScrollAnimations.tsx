"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { ReactNode, useRef } from "react";

interface AnimationProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

// Blur and scale in - dramatic entrance
export function BlurIn({ children, className = "", delay = 0 }: AnimationProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, filter: "blur(20px)", scale: 0.8 }}
      animate={inView ? { opacity: 1, filter: "blur(0px)", scale: 1 } : {}}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// 3D flip card reveal
export function FlipIn({ children, className = "", delay = 0 }: AnimationProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, rotateX: -80, perspective: 1000 }}
      animate={inView ? { opacity: 1, rotateX: 0 } : {}}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      style={{ transformStyle: "preserve-3d" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Rotate and scale in
export function RotateIn({ children, className = "", delay = 0 }: AnimationProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, rotate: -10, scale: 0.8 }}
      animate={inView ? { opacity: 1, rotate: 0, scale: 1 } : {}}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Bounce in with spring
export function BounceIn({ children, className = "", delay = 0 }: AnimationProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 100, scale: 0.5 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{
        type: "spring",
        stiffness: 100,
        damping: 12,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Slide up with glow effect
export function GlowUp({ children, className = "", delay = 0 }: AnimationProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        y: 80,
        filter: "drop-shadow(0 0 0px rgba(9, 132, 227, 0))"
      }}
      animate={inView ? {
        opacity: 1,
        y: 0,
        filter: "drop-shadow(0 0 30px rgba(9, 132, 227, 0.3))"
      } : {}}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Text reveal with clip path
export function TextReveal({ children, className = "", delay = 0 }: AnimationProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      animate={inView ? { clipPath: "inset(0 0% 0 0)" } : {}}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Parallax scroll effect
export function Parallax({
  children,
  className = "",
  speed = 0.5
}: AnimationProps & { speed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [100 * speed, -100 * speed]);
  const smoothY = useSpring(y, { stiffness: 100, damping: 30 });

  return (
    <motion.div ref={ref} style={{ y: smoothY }} className={className}>
      {children}
    </motion.div>
  );
}

// Scale on scroll - gets bigger as you scroll past
export function ScaleOnScroll({ children, className = "" }: AnimationProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"]
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);

  return (
    <motion.div
      ref={ref}
      style={{ scale, opacity }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Staggered list with spring physics
export function StaggerList({
  children,
  className = ""
}: { children: ReactNode; className?: string }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.15,
            delayChildren: 0.1,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerChild({
  children,
  className = ""
}: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: {
          opacity: 0,
          y: 40,
          scale: 0.9,
          filter: "blur(10px)"
        },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          transition: {
            type: "spring",
            stiffness: 100,
            damping: 15,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Floating animation (continuous)
export function Float({
  children,
  className = "",
  intensity = 10
}: AnimationProps & { intensity?: number }) {
  return (
    <motion.div
      animate={{
        y: [-intensity, intensity, -intensity],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Pulse glow animation (continuous) - subtle version
export function PulseGlow({ children, className = "" }: AnimationProps) {
  return (
    <motion.div
      animate={{
        boxShadow: [
          "0 0 10px rgba(9, 132, 227, 0.05)",
          "0 0 20px rgba(9, 132, 227, 0.12)",
          "0 0 10px rgba(9, 132, 227, 0.05)",
        ],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Dramatic slide from bottom with rotation
export function DramaticSlide({ children, className = "", delay = 0 }: AnimationProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        y: 150,
        rotateX: 45,
        scale: 0.7,
      }}
      animate={inView ? {
        opacity: 1,
        y: 0,
        rotateX: 0,
        scale: 1,
      } : {}}
      transition={{
        duration: 1,
        delay,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      style={{ perspective: 1000, transformStyle: "preserve-3d" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Elastic pop
export function ElasticPop({ children, className = "", delay = 0 }: AnimationProps) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 10,
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Horizontal swipe reveal
export function SwipeReveal({
  children,
  className = "",
  delay = 0,
  direction = "left"
}: AnimationProps & { direction?: "left" | "right" }) {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        x: direction === "left" ? -100 : 100,
        skewX: direction === "left" ? 10 : -10,
      }}
      animate={inView ? {
        opacity: 1,
        x: 0,
        skewX: 0,
      } : {}}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
