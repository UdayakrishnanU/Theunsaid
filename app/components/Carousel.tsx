"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Generic swipeable/slidable carousel used by both the pinned shelf and the
// top-of-page trending banner. Native horizontal scroll + scroll-snap does
// the actual "slidable" work (touch drag on mobile, trackpad swipe, click
// drag) — this just adds arrow buttons, dot indicators, and optional
// auto-advance on top of that.
export default function Carousel({
  children,
  trackClassName = "",
  count,
  autoAdvanceMs,
  showArrows = true,
  showDots = true,
  ariaLabel,
}: {
  children: React.ReactNode;
  trackClassName?: string;
  count: number;
  autoAdvanceMs?: number;
  showArrows?: boolean;
  showDots?: boolean;
  ariaLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);

  const scrollToIndex = useCallback(
    (i: number) => {
      const el = trackRef.current;
      if (!el || count === 0) return;
      const clamped = ((i % count) + count) % count;
      const child = el.children[clamped] as HTMLElement | undefined;
      if (child) el.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
    },
    [count]
  );

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const kids = Array.from(el.children) as HTMLElement[];
        let closest = 0;
        let best = Infinity;
        kids.forEach((c, i) => {
          const d = Math.abs(c.offsetLeft - el.scrollLeft);
          if (d < best) {
            best = d;
            closest = i;
          }
        });
        setIndex(closest);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!autoAdvanceMs || count <= 1) return;
    const id = setInterval(() => {
      if (!pausedRef.current) scrollToIndex(index + 1);
    }, autoAdvanceMs);
    return () => clearInterval(id);
  }, [autoAdvanceMs, count, index, scrollToIndex]);

  if (!count) return null;

  return (
    <div
      className="carousel"
      onPointerEnter={() => {
        pausedRef.current = true;
      }}
      onPointerLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div className={"carousel-track " + trackClassName} ref={trackRef}>
        {children}
      </div>
      {showArrows && count > 1 && (
        <>
          <button type="button" className="car-arrow car-prev" aria-label="Previous slide" onClick={() => scrollToIndex(index - 1)}>
            ‹
          </button>
          <button type="button" className="car-arrow car-next" aria-label="Next slide" onClick={() => scrollToIndex(index + 1)}>
            ›
          </button>
        </>
      )}
      {showDots && count > 1 && (
        <div className="car-dots" role="tablist" aria-label={ariaLabel}>
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              className={"car-dot" + (i === index ? " on" : "")}
              role="tab"
              aria-label={`Go to slide ${i + 1}`}
              aria-selected={i === index}
              onClick={() => scrollToIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
