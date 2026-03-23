"use client";

interface MeshGradientProps {
  mobile?: boolean;
}

export default function MeshGradient({ mobile = false }: MeshGradientProps) {
  const blobs = mobile
    ? [
        { size: 280, x: "10%", y: "15%", hueVar: 1, duration: 12 },
        { size: 220, x: "65%", y: "50%", hueVar: 2, duration: 16 },
        { size: 180, x: "30%", y: "75%", hueVar: 3, duration: 14 },
      ]
    : [
        { size: 400, x: "5%", y: "10%", hueVar: 1, duration: 10 },
        { size: 350, x: "60%", y: "20%", hueVar: 2, duration: 14 },
        { size: 300, x: "25%", y: "65%", hueVar: 3, duration: 18 },
        { size: 280, x: "70%", y: "70%", hueVar: 4, duration: 22 },
        { size: 250, x: "40%", y: "35%", hueVar: 5, duration: 16 },
      ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {blobs.map((blob, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: blob.size,
            height: blob.size,
            left: blob.x,
            top: blob.y,
            background: `radial-gradient(circle, hsla(var(--mesh-hue-${blob.hueVar}), 80%, 55%, 0.15) 0%, transparent 70%)`,
            filter: "blur(80px)",
            animation: `mesh-drift-${i + 1} ${blob.duration}s ease-in-out infinite`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}
