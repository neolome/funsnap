"use client";

import { useEffect, useState } from "react";
import type { Filter } from "@/lib/filters";

type Props = { filter: Filter };

export function FilterNamePill({ filter }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (filter.id === "none") {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(t);
  }, [filter.id]);

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-30 flex justify-center transition-all duration-300 ${
        visible ? "opacity-100 -translate-y-0" : "opacity-0 -translate-y-2"
      }`}
      style={{ top: "44%" }}
    >
      <div className="flex items-center gap-2 rounded-full bg-black/55 px-5 py-2 text-white backdrop-blur-md ring-1 ring-white/15">
        <span className="text-2xl leading-none">{filter.emoji}</span>
        <span className="text-sm font-semibold tracking-wide">{filter.name}</span>
      </div>
    </div>
  );
}
