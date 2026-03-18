"use client";

interface GradientDividerProps {
  variant: "slant-left" | "slant-right";
  className?: string;
  fromColor?: string;
  toColor?: string;
}

export default function GradientDivider({
  variant,
  className = "",
  fromColor = "#2B343E",
  toColor = "#1a1f26",
}: GradientDividerProps) {
  const points =
    variant === "slant-left" ? "0,0 100,100 0,100" : "100,0 100,100 0,100";

  return (
    <div
      className={`relative h-16 md:h-24 overflow-hidden divider-texture ${className}`}
      style={{
        background:
          variant === "slant-right" ? toColor : undefined,
      }}
    >
      <svg
        className="absolute w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id={`divider-grad-${variant}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor={variant === "slant-left" ? toColor : fromColor}>
              <animate
                attributeName="stop-color"
                values={`${variant === "slant-left" ? toColor : fromColor};#0984E3;${variant === "slant-left" ? toColor : fromColor}`}
                dur="8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="stop-opacity"
                values="1;0.85;1"
                dur="8s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor={variant === "slant-left" ? toColor : fromColor} />
          </linearGradient>
        </defs>
        <polygon
          points={points}
          fill={`url(#divider-grad-${variant})`}
        />
      </svg>
    </div>
  );
}
