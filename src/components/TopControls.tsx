"use client";

import { useState } from "react";

type Props = {
  onSwitchCamera: () => void;
  onRandomFilter: () => void;
  onOpenCategories: () => void;
  search: string;
  onSearchChange: (s: string) => void;
};

export function TopControls({
  onSwitchCamera,
  onRandomFilter,
  onOpenCategories,
  search,
  onSearchChange,
}: Props) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 pt-[max(env(safe-area-inset-top),12px)]">
      <div className="rounded-full bg-black/45 px-3.5 py-1.5 text-xs font-extrabold tracking-wide backdrop-blur ring-1 ring-white/10">
        FunSnap
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <IconBtn onClick={onSwitchCamera} title="Switch caméra" emoji="🔄" />
          <IconBtn onClick={onRandomFilter} title="Filtre aléatoire" emoji="🎲" />
          <IconBtn onClick={onOpenCategories} title="Catégories" emoji="📂" />
          <IconBtn onClick={() => setShowSearch((s) => !s)} title="Recherche" emoji="🔍" />
        </div>
        {showSearch && (
          <input
            autoFocus
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Chercher un filtre…"
            className="w-56 rounded-full bg-black/55 px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none backdrop-blur ring-1 ring-white/20"
          />
        )}
      </div>
    </div>
  );
}

function IconBtn({ emoji, onClick, title }: { emoji: string; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-lg backdrop-blur ring-1 ring-white/10 active:scale-90 transition-transform"
    >
      {emoji}
    </button>
  );
}
