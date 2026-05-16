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

  // Auto-scroll active filter into view
  useEffect(() => {
    const el = scrollerRef.current?.querySelector(`[data-filter-id="${activeFilterId}"]`);
    if (el && el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeFilterId]);

  return (
    <div
      ref={scrollerRef}
      className="no-scrollbar flex w-full snap-x snap-mandatory gap-2 overflow-x-auto px-[40vw] py-2"
    >
      {items.map((f) => {
        const active = f.id === activeFilterId;
        return (
          <button
            key={f.id}
            data-filter-id={f.id}
            onClick={() => onSelect(f)}
            className={cn(
              "flex shrink-0 snap-center flex-col items-center justify-center rounded-2xl backdrop-blur-md transition-all",
              active
                ? "h-20 w-20 bg-white text-black shadow-lg shadow-white/30 ring-4 ring-white/40"
                : "h-16 w-16 bg-white/15 text-white hover:bg-white/25",
            )}
          >
            <span className={active ? "text-3xl" : "text-2xl"}>{f.emoji}</span>
            <span className={cn("mt-0.5 px-1 text-[10px] font-medium leading-tight line-clamp-1", active ? "text-black/80" : "text-white/90")}>
              {f.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
