export type FilterCategory =
  | "animaux"
  | "chapeaux"
  | "lunettes"
  | "personnages"
  | "epique"
  | "deformations"
  | "ambiance"
  | "couleur";

export type FilterRenderArgs = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  landmarks: { x: number; y: number; z: number }[];
  blendshapes?: Record<string, number>;
  time: number;
};

export type Filter = {
  id: string;
  name: string;
  emoji: string;
  category: FilterCategory;
  render: (args: FilterRenderArgs) => void;
};

export const CATEGORIES: { id: FilterCategory; label: string; emoji: string }[] = [
  { id: "animaux", label: "Animaux", emoji: "🐶" },
  { id: "chapeaux", label: "Chapeaux", emoji: "👑" },
  { id: "lunettes", label: "Lunettes", emoji: "😎" },
  { id: "personnages", label: "Personnages", emoji: "🤡" },
  { id: "epique", label: "Épiques", emoji: "🔥" },
  { id: "deformations", label: "Déformations", emoji: "👽" },
  { id: "ambiance", label: "Ambiance", emoji: "✨" },
  { id: "couleur", label: "Couleur", emoji: "🎨" },
];

// MediaPipe Face Landmarker key indices
const LM = {
  forehead: 10,
  noseTip: 1,
  noseTop: 6,
  chin: 152,
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  leftEyeCenter: 468,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  rightEyeTop: 386,
  rightEyeBottom: 374,
  rightEyeCenter: 473,
  upperLipTop: 13,
  upperLipBottom: 12,
  lowerLipTop: 14,
  lowerLipBottom: 17,
  mouthLeft: 78,
  mouthRight: 308,
  mouthCenter: 13,
  leftCheek: 234,
  rightCheek: 454,
  faceLeft: 234,
  faceRight: 454,
  faceTop: 10,
};

function pt(lm: FilterRenderArgs["landmarks"], i: number, w: number, h: number) {
  const p = lm[i];
  return { x: p.x * w, y: p.y * h };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function faceAngle(lm: FilterRenderArgs["landmarks"], w: number, h: number) {
  const l = pt(lm, LM.leftEyeOuter, w, h);
  const r = pt(lm, LM.rightEyeOuter, w, h);
  return Math.atan2(r.y - l.y, r.x - l.x);
}

function faceWidth(lm: FilterRenderArgs["landmarks"], w: number, h: number) {
  return dist(pt(lm, LM.faceLeft, w, h), pt(lm, LM.faceRight, w, h));
}

function drawEmojiAt(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number,
  y: number,
  size: number,
  rotation = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.font = `${size}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
}

// Generic "ears on top of head" filter
function makeEarsFilter(id: string, name: string, leftEmoji: string, rightEmoji: string, noseEmoji?: string): Filter["render"] {
  return ({ ctx, width, height, landmarks }) => {
    const forehead = pt(landmarks, LM.forehead, width, height);
    const leftEye = pt(landmarks, LM.leftEyeOuter, width, height);
    const rightEye = pt(landmarks, LM.rightEyeOuter, width, height);
    const noseTip = pt(landmarks, LM.noseTip, width, height);
    const fw = faceWidth(landmarks, width, height);
    const angle = faceAngle(landmarks, width, height);
    const earSize = fw * 0.45;

    // ear offset perpendicular above eyes
    const cx = (leftEye.x + rightEye.x) / 2;
    const cy = (leftEye.y + rightEye.y) / 2;
    const upX = Math.sin(angle);
    const upY = -Math.cos(angle);
    const sideX = Math.cos(angle);
    const sideY = Math.sin(angle);

    const headTopX = cx + upX * fw * 0.55;
    const headTopY = cy + upY * fw * 0.55;

    drawEmojiAt(
      ctx,
      leftEmoji,
      headTopX - sideX * fw * 0.35,
      headTopY - sideY * fw * 0.35,
      earSize,
      angle - 0.3,
    );
    drawEmojiAt(
      ctx,
      rightEmoji,
      headTopX + sideX * fw * 0.35,
      headTopY + sideY * fw * 0.35,
      earSize,
      angle + 0.3,
    );

    if (noseEmoji) {
      drawEmojiAt(ctx, noseEmoji, noseTip.x, noseTip.y, fw * 0.18, angle);
    }
    // tag forehead use so eslint won't whine
    void forehead;
  };
}

// Single emoji on top of head (hat/crown)
function makeHatFilter(emoji: string, sizeFactor = 0.7, yOffset = 0.7): Filter["render"] {
  return ({ ctx, width, height, landmarks }) => {
    const leftEye = pt(landmarks, LM.leftEyeOuter, width, height);
    const rightEye = pt(landmarks, LM.rightEyeOuter, width, height);
    const fw = faceWidth(landmarks, width, height);
    const angle = faceAngle(landmarks, width, height);
    const cx = (leftEye.x + rightEye.x) / 2;
    const cy = (leftEye.y + rightEye.y) / 2;
    const upX = Math.sin(angle);
    const upY = -Math.cos(angle);
    drawEmojiAt(ctx, emoji, cx + upX * fw * yOffset, cy + upY * fw * yOffset, fw * sizeFactor, angle);
  };
}

// Glasses across eyes
function makeGlassesFilter(emoji: string, sizeFactor = 1.4): Filter["render"] {
  return ({ ctx, width, height, landmarks }) => {
    const leftEye = pt(landmarks, LM.leftEyeOuter, width, height);
    const rightEye = pt(landmarks, LM.rightEyeOuter, width, height);
    const fw = faceWidth(landmarks, width, height);
    const angle = faceAngle(landmarks, width, height);
    const cx = (leftEye.x + rightEye.x) / 2;
    const cy = (leftEye.y + rightEye.y) / 2;
    drawEmojiAt(ctx, emoji, cx, cy, fw * sizeFactor * 0.5, angle);
  };
}

// Eye replacement (one per eye)
function makeEyeFilter(emoji: string, sizeFactor = 0.18): Filter["render"] {
  return ({ ctx, width, height, landmarks }) => {
    const leftEye = pt(landmarks, LM.leftEyeCenter, width, height);
    const rightEye = pt(landmarks, LM.rightEyeCenter, width, height);
    const fw = faceWidth(landmarks, width, height);
    const angle = faceAngle(landmarks, width, height);
    drawEmojiAt(ctx, emoji, leftEye.x, leftEye.y, fw * sizeFactor, angle);
    drawEmojiAt(ctx, emoji, rightEye.x, rightEye.y, fw * sizeFactor, angle);
  };
}

// Mouth emitter (rainbow, fire from mouth)
function makeMouthEmitterFilter(emojis: string[]): Filter["render"] {
  return ({ ctx, width, height, landmarks, time }) => {
    const upper = pt(landmarks, LM.upperLipBottom, width, height);
    const lower = pt(landmarks, LM.lowerLipTop, width, height);
    const mouthOpen = dist(upper, lower);
    const fw = faceWidth(landmarks, width, height);
    if (mouthOpen < fw * 0.04) return; // mouth needs to be open
    const mouth = { x: (upper.x + lower.x) / 2, y: (upper.y + lower.y) / 2 };
    const count = 14;
    for (let i = 0; i < count; i++) {
      const seed = (i * 137 + Math.floor(time / 50)) % 1000;
      const t = ((time / 1000 + i / count) % 1);
      const angle = Math.PI / 2 + (Math.sin(seed) * 0.6);
      const r = fw * 0.15 + t * fw * 1.4;
      const x = mouth.x + Math.cos(Math.PI - angle) * r;
      const y = mouth.y + Math.sin(angle) * r;
      const size = fw * 0.1 * (1 - t * 0.5);
      const emoji = emojis[i % emojis.length];
      ctx.globalAlpha = 1 - t;
      drawEmojiAt(ctx, emoji, x, y, size);
    }
    ctx.globalAlpha = 1;
  };
}

// Ambient floating particles around face
function makeAmbientFilter(emojis: string[], count = 18): Filter["render"] {
  return ({ ctx, width, height, landmarks, time }) => {
    const cheek = pt(landmarks, LM.leftCheek, width, height);
    const otherCheek = pt(landmarks, LM.rightCheek, width, height);
    const center = { x: (cheek.x + otherCheek.x) / 2, y: (cheek.y + otherCheek.y) / 2 };
    const fw = faceWidth(landmarks, width, height);
    for (let i = 0; i < count; i++) {
      const t = ((time / 2000 + i / count) % 1);
      const angle = (i / count) * Math.PI * 2 + time / 3000;
      const r = fw * (1 + t * 0.8);
      const x = center.x + Math.cos(angle) * r;
      const y = center.y + Math.sin(angle) * r - t * fw * 0.5;
      const size = fw * 0.12 * (1 - t * 0.4);
      ctx.globalAlpha = Math.sin(t * Math.PI);
      drawEmojiAt(ctx, emojis[i % emojis.length], x, y, size);
    }
    ctx.globalAlpha = 1;
  };
}

// Single emoji at nose
function makeNoseFilter(emoji: string, sizeFactor = 0.22): Filter["render"] {
  return ({ ctx, width, height, landmarks }) => {
    const nose = pt(landmarks, LM.noseTip, width, height);
    const fw = faceWidth(landmarks, width, height);
    drawEmojiAt(ctx, emoji, nose.x, nose.y, fw * sizeFactor);
  };
}

// Color overlay filters - applied via canvas globalCompositeOperation
function makeColorFilter(fn: (ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => void): Filter["render"] {
  return ({ ctx, width, height, time }) => {
    fn(ctx, width, height, time);
  };
}

export const FILTERS: Filter[] = [
  // 🐶 ANIMAUX (12)
  { id: "dog", name: "Chien", emoji: "🐶", category: "animaux", render: makeEarsFilter("dog", "Chien", "🦴", "🦴", "🐽") },
  { id: "cat", name: "Chat", emoji: "🐱", category: "animaux", render: makeEarsFilter("cat", "Chat", "🐾", "🐾", "🐱") },
  { id: "bunny", name: "Lapin", emoji: "🐰", category: "animaux", render: makeEarsFilter("bunny", "Lapin", "🥕", "🥕", "🐰") },
  { id: "pig", name: "Cochon", emoji: "🐷", category: "animaux", render: makeNoseFilter("🐽", 0.3) },
  { id: "panda", name: "Panda", emoji: "🐼", category: "animaux", render: makeEyeFilter("⚫", 0.22) },
  { id: "frog", name: "Grenouille", emoji: "🐸", category: "animaux", render: makeHatFilter("🐸", 0.8, 0.6) },
  { id: "monkey", name: "Singe", emoji: "🐵", category: "animaux", render: makeHatFilter("🙈", 0.9, 0.5) },
  { id: "lion", name: "Lion", emoji: "🦁", category: "animaux", render: makeHatFilter("🦁", 1.2, 0.4) },
  { id: "tiger", name: "Tigre", emoji: "🐯", category: "animaux", render: makeHatFilter("🐯", 1.1, 0.5) },
  { id: "bear", name: "Ours", emoji: "🐻", category: "animaux", render: makeEarsFilter("bear", "Ours", "🟤", "🟤", "🐻") },
  { id: "fox", name: "Renard", emoji: "🦊", category: "animaux", render: makeEarsFilter("fox", "Renard", "🔺", "🔺", "🦊") },
  { id: "koala", name: "Koala", emoji: "🐨", category: "animaux", render: makeEarsFilter("koala", "Koala", "⬜", "⬜", "🐨") },

  // 👑 CHAPEAUX (8)
  { id: "crown", name: "Couronne", emoji: "👑", category: "chapeaux", render: makeHatFilter("👑", 0.8, 0.7) },
  { id: "party", name: "Chapeau fête", emoji: "🥳", category: "chapeaux", render: makeHatFilter("🎉", 0.8, 0.7) },
  { id: "viking", name: "Viking", emoji: "⛑️", category: "chapeaux", render: makeHatFilter("⛑️", 0.9, 0.6) },
  { id: "santa", name: "Père Noël", emoji: "🎅", category: "chapeaux", render: makeHatFilter("🎅", 1.0, 0.5) },
  { id: "cowboy", name: "Cowboy", emoji: "🤠", category: "chapeaux", render: makeHatFilter("🤠", 1.2, 0.4) },
  { id: "halo", name: "Auréole", emoji: "😇", category: "chapeaux", render: makeHatFilter("👼", 0.7, 0.8) },
  { id: "devil", name: "Diable", emoji: "😈", category: "chapeaux", render: makeEarsFilter("devil", "Diable", "🔥", "🔥") },
  { id: "wizard", name: "Magicien", emoji: "🧙", category: "chapeaux", render: makeHatFilter("🧙‍♂️", 1.0, 0.5) },

  // 😎 LUNETTES (8)
  { id: "sunglasses", name: "Lunettes soleil", emoji: "😎", category: "lunettes", render: makeGlassesFilter("🕶️", 2.0) },
  { id: "dealwithit", name: "Deal With It", emoji: "😎", category: "lunettes", render: makeGlassesFilter("🕶️", 2.2) },
  { id: "monocle", name: "Monocle", emoji: "🧐", category: "lunettes", render: makeGlassesFilter("🧐", 1.8) },
  { id: "skimask", name: "Masque ski", emoji: "🥽", category: "lunettes", render: makeGlassesFilter("🥽", 2.0) },
  { id: "zorro", name: "Masque Zorro", emoji: "🦸", category: "lunettes", render: makeGlassesFilter("🦹", 2.0) },
  { id: "venetian", name: "Masque vénitien", emoji: "🎭", category: "lunettes", render: makeGlassesFilter("🎭", 2.0) },
  { id: "3d", name: "Lunettes 3D", emoji: "👓", category: "lunettes", render: makeGlassesFilter("👓", 1.8) },
  { id: "nerd", name: "Lunettes nerd", emoji: "🤓", category: "lunettes", render: makeGlassesFilter("🤓", 2.0) },

  // 🤡 PERSONNAGES (10)
  { id: "clown", name: "Clown", emoji: "🤡", category: "personnages", render: makeNoseFilter("🔴", 0.25) },
  { id: "zombie", name: "Zombie", emoji: "🧟", category: "personnages", render: makeColorFilter((ctx, w, h) => {
    ctx.fillStyle = "rgba(50, 150, 50, 0.25)";
    ctx.fillRect(0, 0, w, h);
  }) },
  { id: "vampire", name: "Vampire", emoji: "🧛", category: "personnages", render: makeHatFilter("🧛", 0.9, 0.6) },
  { id: "ghost", name: "Fantôme", emoji: "👻", category: "personnages", render: makeColorFilter((ctx, w, h) => {
    ctx.fillStyle = "rgba(200, 200, 255, 0.3)";
    ctx.fillRect(0, 0, w, h);
  }) },
  { id: "angel", name: "Ange", emoji: "👼", category: "personnages", render: makeHatFilter("😇", 0.8, 0.7) },
  { id: "skull", name: "Squelette", emoji: "💀", category: "personnages", render: makeHatFilter("💀", 1.1, 0.4) },
  { id: "witch", name: "Sorcière", emoji: "🧙‍♀️", category: "personnages", render: makeHatFilter("🧙‍♀️", 1.0, 0.5) },
  { id: "pirate", name: "Pirate", emoji: "🏴‍☠️", category: "personnages", render: makeHatFilter("🏴‍☠️", 1.0, 0.6) },
  { id: "robot", name: "Robot", emoji: "🤖", category: "personnages", render: makeHatFilter("🤖", 1.0, 0.5) },
  { id: "joker", name: "Joker", emoji: "🃏", category: "personnages", render: makeHatFilter("🃏", 1.0, 0.5) },

  // 🔥 ÉPIQUES (12)
  { id: "laser-eyes", name: "Yeux laser", emoji: "👀", category: "epique", render: ({ ctx, width, height, landmarks }) => {
    const l = pt(landmarks, LM.leftEyeCenter, width, height);
    const r = pt(landmarks, LM.rightEyeCenter, width, height);
    ctx.save();
    ctx.fillStyle = "rgba(255, 0, 80, 0.9)";
    ctx.shadowColor = "red";
    ctx.shadowBlur = 30;
    [l, r].forEach(eye => {
      ctx.beginPath();
      ctx.moveTo(eye.x - 8, eye.y);
      ctx.lineTo(eye.x + 8, eye.y);
      ctx.lineTo(width, eye.y - height * 0.05);
      ctx.lineTo(width, eye.y + height * 0.05);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  } },
  { id: "fire-eyes", name: "Yeux feu", emoji: "🔥", category: "epique", render: makeEyeFilter("🔥", 0.2) },
  { id: "heart-eyes", name: "Yeux cœur", emoji: "😍", category: "epique", render: makeEyeFilter("❤️", 0.18) },
  { id: "star-eyes", name: "Yeux étoile", emoji: "🤩", category: "epique", render: makeEyeFilter("⭐", 0.18) },
  { id: "dollar-eyes", name: "Yeux dollar", emoji: "🤑", category: "epique", render: makeEyeFilter("💲", 0.18) },
  { id: "galaxy-eyes", name: "Yeux galaxie", emoji: "🌌", category: "epique", render: makeEyeFilter("🌌", 0.2) },
  { id: "rainbow-mouth", name: "Arc-en-ciel", emoji: "🌈", category: "epique", render: makeMouthEmitterFilter(["🌈", "✨", "💖", "⭐"]) },
  { id: "fire-mouth", name: "Cracher feu", emoji: "🔥", category: "epique", render: makeMouthEmitterFilter(["🔥", "💥"]) },
  { id: "lightning", name: "Éclairs", emoji: "⚡", category: "epique", render: makeAmbientFilter(["⚡"], 8) },
  { id: "aura", name: "Aura", emoji: "✨", category: "epique", render: ({ ctx, width, height, landmarks, time }) => {
    const cheek = pt(landmarks, LM.leftCheek, width, height);
    const other = pt(landmarks, LM.rightCheek, width, height);
    const cx = (cheek.x + other.x) / 2;
    const cy = (cheek.y + other.y) / 2;
    const fw = faceWidth(landmarks, width, height);
    const pulse = (Math.sin(time / 300) + 1) / 2;
    const grad = ctx.createRadialGradient(cx, cy, fw * 0.5, cx, cy, fw * 1.5);
    grad.addColorStop(0, "rgba(255, 200, 100, 0)");
    grad.addColorStop(0.7, `rgba(255, 200, 100, ${0.4 + pulse * 0.3})`);
    grad.addColorStop(1, "rgba(255, 100, 200, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } },
  { id: "flame-crown", name: "Couronne flamme", emoji: "🔥", category: "epique", render: makeHatFilter("🔥", 1.0, 0.6) },
  { id: "neon-halo", name: "Halo néon", emoji: "💫", category: "epique", render: ({ ctx, width, height, landmarks, time }) => {
    const leftEye = pt(landmarks, LM.leftEyeOuter, width, height);
    const rightEye = pt(landmarks, LM.rightEyeOuter, width, height);
    const fw = faceWidth(landmarks, width, height);
    const cx = (leftEye.x + rightEye.x) / 2;
    const cy = (leftEye.y + rightEye.y) / 2;
    const angle = faceAngle(landmarks, width, height);
    const upX = Math.sin(angle);
    const upY = -Math.cos(angle);
    ctx.save();
    ctx.translate(cx + upX * fw * 0.7, cy + upY * fw * 0.7);
    ctx.rotate(angle);
    ctx.strokeStyle = `hsl(${(time / 20) % 360}, 100%, 60%)`;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 25;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, fw * 0.6, fw * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } },

  // 👽 DÉFORMATIONS (6) — visual overlays without real warp
  { id: "big-eyes", name: "Gros yeux", emoji: "👀", category: "deformations", render: makeEyeFilter("👁️", 0.3) },
  { id: "alien", name: "Alien", emoji: "👽", category: "deformations", render: makeEyeFilter("⬛", 0.32) },
  { id: "baby", name: "Bébé", emoji: "👶", category: "deformations", render: makeHatFilter("👶", 1.1, 0.5) },
  { id: "old", name: "Vieillard", emoji: "👴", category: "deformations", render: makeHatFilter("👴", 1.0, 0.5) },
  { id: "cartoon", name: "Cartoon", emoji: "🎨", category: "deformations", render: makeColorFilter((ctx, w, h) => {
    ctx.fillStyle = "rgba(255, 255, 100, 0.15)";
    ctx.fillRect(0, 0, w, h);
  }) },
  { id: "pixel", name: "Pixel", emoji: "🟫", category: "deformations", render: makeColorFilter((ctx, w, h) => {
    // pixelation via downscale+upscale
    const size = 12;
    const off = document.createElement("canvas");
    off.width = Math.floor(w / size);
    off.height = Math.floor(h / size);
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.imageSmoothingEnabled = false;
    octx.drawImage(ctx.canvas, 0, 0, off.width, off.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
  }) },

  // ✨ AMBIANCE (10)
  { id: "hearts", name: "Pluie de cœurs", emoji: "❤️", category: "ambiance", render: makeAmbientFilter(["❤️", "💕", "💖"]) },
  { id: "stars", name: "Étoiles", emoji: "⭐", category: "ambiance", render: makeAmbientFilter(["⭐", "✨", "🌟"]) },
  { id: "butterflies", name: "Papillons", emoji: "🦋", category: "ambiance", render: makeAmbientFilter(["🦋"]) },
  { id: "petals", name: "Pétales", emoji: "🌸", category: "ambiance", render: makeAmbientFilter(["🌸", "🌺", "🌷"]) },
  { id: "bubbles", name: "Bulles", emoji: "🫧", category: "ambiance", render: makeAmbientFilter(["🫧", "💧"]) },
  { id: "snow", name: "Neige", emoji: "❄️", category: "ambiance", render: makeAmbientFilter(["❄️", "❅"]) },
  { id: "confetti", name: "Confettis", emoji: "🎊", category: "ambiance", render: makeAmbientFilter(["🎊", "🎉"]) },
  { id: "fireworks", name: "Feu artifice", emoji: "🎆", category: "ambiance", render: makeAmbientFilter(["🎆", "🎇"]) },
  { id: "storm", name: "Orage", emoji: "⛈️", category: "ambiance", render: makeAmbientFilter(["⚡", "💧"]) },
  { id: "galaxy", name: "Galaxie", emoji: "🌌", category: "ambiance", render: makeAmbientFilter(["🌟", "✨", "💫"]) },

  // 🎨 COULEUR (6)
  { id: "bw", name: "Noir & Blanc", emoji: "⚫", category: "couleur", render: makeColorFilter((ctx, w, h) => {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
  }) },
  { id: "sepia", name: "Sépia", emoji: "🟫", category: "couleur", render: makeColorFilter((ctx, w, h) => {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    }
    ctx.putImageData(img, 0, 0);
  }) },
  { id: "vhs", name: "VHS 90's", emoji: "📼", category: "couleur", render: makeColorFilter((ctx, w, h, time) => {
    // scanlines + tint
    ctx.fillStyle = "rgba(255, 0, 255, 0.05)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y + ((time / 30) % 4), w, 1);
    }
  }) },
  { id: "glitch", name: "Glitch", emoji: "📺", category: "couleur", render: makeColorFilter((ctx, w, h, time) => {
    const slices = 6;
    for (let i = 0; i < slices; i++) {
      const y = (Math.sin(time / 200 + i) + 1) / 2 * h;
      const sh = h / slices / 2;
      const dx = Math.sin(time / 100 + i * 3) * 20;
      const img = ctx.getImageData(0, y, w, sh);
      ctx.putImageData(img, dx, y);
    }
  }) },
  { id: "neon", name: "Néon cyber", emoji: "🌃", category: "couleur", render: makeColorFilter((ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "rgba(255, 0, 200, 0.2)");
    grad.addColorStop(1, "rgba(0, 200, 255, 0.2)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }) },
  { id: "anime", name: "Anime", emoji: "🌸", category: "couleur", render: makeColorFilter((ctx, w, h) => {
    ctx.fillStyle = "rgba(255, 200, 220, 0.18)";
    ctx.fillRect(0, 0, w, h);
  }) },
];

export const NO_FILTER: Filter = {
  id: "none",
  name: "Aucun",
  emoji: "🚫",
  category: "animaux",
  render: () => {},
};

export function getFiltersByCategory(cat: FilterCategory) {
  return FILTERS.filter(f => f.category === cat);
}

export function findFilter(id: string): Filter | undefined {
  if (id === "none") return NO_FILTER;
  return FILTERS.find(f => f.id === id);
}
