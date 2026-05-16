"use client";

import { CATEGORIES } from "@/lib/filters";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  category: string;
  onSelectCategory: (id: string) => void;
};

export function CategoryBar({ open, onClose, category, onSelectCategory }: Props) {
  if (!open) return null;
  const all = [{ id: "all", label: "Tout", emoji: "🌈" }, ...CATEGORIES];
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl"
        aria-label="Fermer"
      >
        ✕
      </button>
      <h2 className="mb-6 text-2xl font-bold">Catégories</h2>
      <div className="grid grid-cols-3 gap-3 px-6">
        {all.map((c) => {
          const active = c.id === category;
          return (
            <button
              key={c.id}
              onClick={() => onSelectCategory(c.id)}
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl px-4 py-5 transition-all",
                active ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20",
              )}
            >
              <span className="text-4xl">{c.emoji}</span>
              <span className="mt-2 text-xs font-semibold">{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
