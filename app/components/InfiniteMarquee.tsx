"use client";

interface InfiniteMarqueeProps {
  items: string[];
  speed?: number;
  separator?: string;
}

export default function InfiniteMarquee({
  items,
  speed = 30,
  separator = " \u2022 ",
}: InfiniteMarqueeProps) {
  const content = items.join(separator) + separator;

  return (
    <div className="overflow-hidden whitespace-nowrap py-6 group">
      <div
        className="inline-block group-hover:[animation-play-state:paused]"
        style={{ animation: `marquee ${speed}s linear infinite` }}
      >
        <span className="text-white/20 text-sm font-medium tracking-widest uppercase">
          {content}
        </span>
        <span className="text-white/20 text-sm font-medium tracking-widest uppercase">
          {content}
        </span>
      </div>
    </div>
  );
}
