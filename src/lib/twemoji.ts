// Twemoji loader — renders emojis as actual SVG images so the look is identical
// across Windows/Mac/iOS/Android, sharp at any scale, with no font padding.
// Asset source: https://github.com/jdecked/twemoji (CC-BY 4.0)

const CDN = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg";

const cache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement | null>>();

/** Convert an emoji string to Twemoji's hyphen-joined hex codepoint. */
export function toCodePoint(emoji: string): string {
  const cps: string[] = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    // Strip variation selector-16 (FE0F) only when there are multiple codepoints,
    // matching Twemoji's behaviour.
    cps.push(cp.toString(16));
  }
  // If the sequence contains multiple codepoints, drop FE0F.
  return cps.length > 1 ? cps.filter((c) => c !== "fe0f").join("-") : cps[0];
}

export function getEmojiUrl(emoji: string): string {
  return `${CDN}/${toCodePoint(emoji)}.svg`;
}

/** Load an emoji image. Resolves with the cached <img> or null on error. */
export function loadEmoji(emoji: string): Promise<HTMLImageElement | null> {
  const existing = cache.get(emoji);
  if (existing) return Promise.resolve(existing);
  const pending = inflight.get(emoji);
  if (pending) return pending;

  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      cache.set(emoji, img);
      inflight.delete(emoji);
      resolve(img);
    };
    img.onerror = () => {
      inflight.delete(emoji);
      resolve(null);
    };
    img.src = getEmojiUrl(emoji);
  });
  inflight.set(emoji, p);
  return p;
}

/** Synchronous getter — returns null if not yet loaded. */
export function getEmojiImage(emoji: string): HTMLImageElement | null {
  return cache.get(emoji) ?? null;
}

/** Preload an array of emojis. Resolves when all done (errors ignored). */
export async function preloadEmojis(emojis: string[]): Promise<void> {
  const unique = Array.from(new Set(emojis));
  await Promise.all(unique.map((e) => loadEmoji(e)));
}
