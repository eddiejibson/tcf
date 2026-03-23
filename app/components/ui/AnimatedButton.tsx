"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type Variant = "primary" | "secondary" | "danger";

interface AnimatedButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: Variant;
}

export default function AnimatedButton({
  variant = "primary",
  className,
  children,
  ...props
}: AnimatedButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
}
