"use client";

import { useMemo, useRef, useEffect } from "react";
import { FILTERS, NO_FILTER, type Filter } from "@/lib/filters";
import { cn } from "@/lib/utils";

type Props = {
  category: string;
  search: string;
  activeFilterId: string;
  onSelect: (f: Filter) => void;
};

export function FilterCarousel({ category, search, activeFilterId, onSelect }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = category === "all" ? FILTERS : FILTERS.filter((f) => f.category === category);
    if (q) base = base.filter((f) => f.name.toLowerCase().includes(q));
    return [NO_FILTER, ...base];
  }, [category, search]);

  useEffect(() => {
    const el = scrollerRef.current?.querySelector(`[data-filter-id="${activeFilterId}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeFilterId]);

  return (
    <div
      ref={scrollerRef}
      className="no-scrollbar flex w-full snap-x snap-mandatory gap-3 overflow-x-auto px-[42vw] py-1"
    >
      {items.map((f) => {
        const active = f.id === activeFilterId;
        return (
          <button
            key={f.id}
            data-filter-id={f.id}
            onClick={() => onSelect(f)}
            aria-label={f.name}
            className={cn(
              "flex shrink-0 snap-center items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 ease-out",
              active
                ? "h-[72px] w-[72px] bg-white text-3xl shadow-[0_0_0_3px_rgba(255,255,255,0.45),0_8px_24px_rgba(0,0,0,0.45)] scale-110"
                : "h-14 w-14 bg-white/15 text-2xl hover:bg-white/25 active:scale-95",
            )}
          >
            <span className="leading-none">{f.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
