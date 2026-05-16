"use client";

import { useState } from "react";
import type { Filter } from "@/lib/filters";

type Props = {
  onSwitchCamera: () => void;
  onRandomFilter: () => void;
  onOpenCategories: () => void;
  search: string;
  onSearchChange: (s: string) => void;
  activeFilter: Filter;
};

export function TopControls({
  onSwitchCamera,
  onRandomFilter,
  onOpenCategories,
  search,
  onSearchChange,
  activeFilter,
}: Props) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4">
      <div className="flex flex-col gap-2">
        <div className="rounded-full bg-black/40 px-3 py-1 text-xs font-bold backdrop-blur">
          ✨ FunSnap
        </div>
        {activeFilter.id !== "none" && (
          <div className="rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
            {activeFilter.emoji} {activeFilter.name}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <IconButton onClick={onSwitchCamera} title="Switch caméra">🔄</IconButton>
          <IconButton onClick={onRandomFilter} title="Filtre aléatoire">🎲</IconButton>
          <IconButton onClick={onOpenCategories} title="Catégories">📂</IconButton>
          <IconButton onClick={() => setShowSearch((s) => !s)} title="Recherche">🔍</IconButton>
        </div>
        {showSearch && (
          <input
            autoFocus
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Chercher un filtre…"
            className="w-56 rounded-full bg-black/50 px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none backdrop-blur ring-1 ring-white/20"
          />
        )}
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-lg backdrop-blur active:scale-90 transition-transform"
    >
      {children}
    </button>
  );
}
