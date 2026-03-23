"use client";

interface GradientBorderProps {
  children: React.ReactNode;
  className?: string;
  rounded?: string;
}

export default function GradientBorder({
  children,
  className,
  rounded = "rounded-[20px]",
}: GradientBorderProps) {
  return (
    <div
      className={`relative p-px ${rounded} ${className ?? ""}`}
      style={{
        background:
          "conic-gradient(from var(--gradient-angle, 0deg), #0984E3, #6c5ce7, #00cec9, #0984E3)",
        animation: "gradient-rotate 4s linear infinite",
      }}
    >
      <div className={`${rounded} bg-[#0d1219] h-full`}>{children}</div>
    </div>
  );
}
