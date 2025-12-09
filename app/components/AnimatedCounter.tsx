"use client";

import CountUp from "react-countup";
import { useInView } from "react-intersection-observer";

interface AnimatedCounterProps {
  end: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}

export default function AnimatedCounter({
  end,
  suffix = "",
  prefix = "",
  duration = 2.5,
  className = "",
}: AnimatedCounterProps) {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.3,
  });

  return (
    <span ref={ref} className={className}>
      {inView ? (
        <CountUp
          start={0}
          end={end}
          duration={duration}
          prefix={prefix}
          suffix={suffix}
          useEasing={true}
          easingFn={(t, b, c, d) => {
            // Custom easing - ease out cubic
            t /= d;
            t--;
            return c * (t * t * t + 1) + b;
          }}
        />
      ) : (
        `${prefix}0${suffix}`
      )}
    </span>
  );
}
