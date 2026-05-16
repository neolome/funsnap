export type FilterCategory =
  | "animaux"
  | "chapeaux"
  | "lunettes"
  | "personnages"
  | "epique"
  | "deformations"
  | "ambiance"
  | "couleur";

export type Point = { x: number; y: number };

export type FaceFrame = {
  // anchor points (in pixel coords)
  center: Point;
  forehead: Point;
  chin: Point;
  noseTip: Point;
  leftEye: Point;
  rightEye: Point;
  eyeCenter: Point;
  mouthCenter: Point;
  mouthLeft: Point;
  mouthRight: Point;
  leftCheek: Point;
  rightCheek: Point;
  topOfHead: Point;
  // dimensions
  faceWidth: number; // cheek to cheek
  faceHeight: number; // chin to forehead
  headWidth: number; // extended to cover cranium/ears
  headHeight: number; // extended to cover top of head
  // orientation
  angle: number; // tilt in radians (from horizontal eye line)
  up: { x: number; y: number }; // unit vector toward top of head
  right: { x: number; y: number }; // unit vector toward right side of face
  // expression
  mouthOpen: number; // 0..1 ratio of mouth opening to face height
};

export type FilterRenderArgs = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  landmarks: Point[];
  frame: FaceFrame | null;
  time: number;
};

export type Filter = {
  id: string;
  name: string;
  emoji: string;
  category: FilterCategory;
  needsFace: boolean; // true if requires landmarks; false for color-only filters
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
  chin: 152,
  leftEyeOuter: 33,
  leftEyeCenter: 468,
  rightEyeOuter: 263,
  rightEyeCenter: 473,
  upperLipBottom: 13,
  lowerLipTop: 14,
  mouthLeft: 78,
  mouthRight: 308,
  leftCheek: 234,
  rightCheek: 454,
};

// Emojis have ~25% transparent padding around the visible glyph in canvas font rendering.
// Multiply intended visible size by this factor when setting fontSize so the glyph fills the target box.
const EMOJI_GLYPH_BOOST = 1.35;

export function computeFaceFrame(landmarks: Point[], w: number, h: number): FaceFrame | null {
  if (!landmarks || landmarks.length < 478) return null;
  const px = (i: number): Point => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
  const forehead = px(LM.forehead);
  const chin = px(LM.chin);
  const noseTip = px(LM.noseTip);
  const leftEye = px(LM.leftEyeOuter);
  const rightEye = px(LM.rightEyeOuter);
  const leftEyeC = px(LM.leftEyeCenter);
  const rightEyeC = px(LM.rightEyeCenter);
  const mouthLeft = px(LM.mouthLeft);
  const mouthRight = px(LM.mouthRight);
  const upperLip = px(LM.upperLipBottom);
  const lowerLip = px(LM.lowerLipTop);
  const leftCheek = px(LM.leftCheek);
  const rightCheek = px(LM.rightCheek);

  const faceWidth = Math.hypot(leftCheek.x - rightCheek.x, leftCheek.y - rightCheek.y);
  const faceHeight = Math.hypot(forehead.x - chin.x, forehead.y - chin.y);

  // Angle = orientation of eye line (from right eye to left eye)
  const angle = Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x);

  // "up" perpendicular to face axis (chin → forehead direction)
  const upVec = { x: (forehead.x - chin.x) / faceHeight, y: (forehead.y - chin.y) / faceHeight };
  const rightVec = { x: Math.cos(angle), y: Math.sin(angle) };

  // Head extends ~30% beyond forehead vertically and ~15% beyond cheeks horizontally
  const headWidth = faceWidth * 1.25;
  const headHeight = faceHeight * 1.55;

  // Top of head: forehead + (up * faceHeight * 0.35)
  const topOfHead = {
    x: forehead.x + upVec.x * faceHeight * 0.35,
    y: forehead.y + upVec.y * faceHeight * 0.35,
  };

  // Face center: midpoint of chin↔forehead, weighted slightly toward eyes
  const center = {
    x: (forehead.x + chin.x) / 2,
    y: (forehead.y + chin.y) / 2,
  };

  const eyeCenter = {
    x: (leftEyeC.x + rightEyeC.x) / 2,
    y: (leftEyeC.y + rightEyeC.y) / 2,
  };

  const mouthCenter = {
    x: (upperLip.x + lowerLip.x) / 2,
    y: (upperLip.y + lowerLip.y) / 2,
  };

  const mouthGap = Math.hypot(upperLip.x - lowerLip.x, upperLip.y - lowerLip.y);
  const mouthOpen = Math.min(1, mouthGap / (faceHeight * 0.18));

  return {
    center,
    forehead,
    chin,
    noseTip,
    leftEye: leftEyeC,
    rightEye: rightEyeC,
    eyeCenter,
    mouthCenter,
    mouthLeft,
    mouthRight,
    leftCheek,
    rightCheek,
    topOfHead,
    faceWidth,
    faceHeight,
    headWidth,
    headHeight,
    angle,
    up: upVec,
    right: rightVec,
    mouthOpen,
  };
}

// --- Drawing primitives ---

function drawEmoji(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number,
  y: number,
  visibleSize: number,
  rotation = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.font = `${visibleSize * EMOJI_GLYPH_BOOST}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","EmojiOne Color",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
}

// Position helpers — all relative to a FaceFrame
function above(f: FaceFrame, offset: number): Point {
  return {
    x: f.topOfHead.x + f.up.x * offset,
    y: f.topOfHead.y + f.up.y * offset,
  };
}

function sideOfHead(f: FaceFrame, side: -1 | 1, upOffset: number): Point {
  const cx = (f.leftCheek.x + f.rightCheek.x) / 2 + f.up.x * f.faceHeight * 0.1;
  const cy = (f.leftCheek.y + f.rightCheek.y) / 2 + f.up.y * f.faceHeight * 0.1;
  const dist = f.headWidth * 0.45;
  return {
    x: cx + f.right.x * side * dist + f.up.x * upOffset,
    y: cy + f.right.y * side * dist + f.up.y * upOffset,
  };
}

// --- Filter type builders ---

function hatFilter(emoji: string, sizeFactor = 1.25, offsetFactor = 0.35): Filter["render"] {
  return ({ ctx, frame }) => {
    if (!frame) return;
    const p = above(frame, frame.faceHeight * offsetFactor);
    drawEmoji(ctx, emoji, p.x, p.y, frame.headWidth * sizeFactor, frame.angle);
  };
}

function maskFilter(emoji: string, sizeFactor = 1.4): Filter["render"] {
  return ({ ctx, frame }) => {
    if (!frame) return;
    drawEmoji(ctx, emoji, frame.center.x, frame.center.y, frame.headWidth * sizeFactor, frame.angle);
  };
}

function earsFilter(leftEmoji: string, rightEmoji: string, opts?: { size?: number; up?: number; tilt?: number }): Filter["render"] {
  const sizeF = opts?.size ?? 0.55;
  const upF = opts?.up ?? 0.2;
  const tilt = opts?.tilt ?? 0.4;
  return ({ ctx, frame }) => {
    if (!frame) return;
    const upOffset = frame.faceHeight * upF;
    const earSize = frame.headWidth * sizeF;
    const left = sideOfHead(frame, -1, upOffset);
    const right = sideOfHead(frame, 1, upOffset);
    drawEmoji(ctx, leftEmoji, left.x, left.y, earSize, frame.angle - tilt);
    drawEmoji(ctx, rightEmoji, right.x, right.y, earSize, frame.angle + tilt);
  };
}

function noseFilter(emoji: string, sizeFactor = 0.35): Filter["render"] {
  return ({ ctx, frame }) => {
    if (!frame) return;
    drawEmoji(ctx, emoji, frame.noseTip.x, frame.noseTip.y, frame.faceWidth * sizeFactor, frame.angle);
  };
}

function eyesFilter(emoji: string, sizeFactor = 0.32): Filter["render"] {
  return ({ ctx, frame }) => {
    if (!frame) return;
    const size = frame.faceWidth * sizeFactor;
    drawEmoji(ctx, emoji, frame.leftEye.x, frame.leftEye.y, size, frame.angle);
    drawEmoji(ctx, emoji, frame.rightEye.x, frame.rightEye.y, size, frame.angle);
  };
}

function mouthEmitter(emojis: string[]): Filter["render"] {
  return ({ ctx, frame, time }) => {
    if (!frame || frame.mouthOpen < 0.15) return;
    const count = 16;
    for (let i = 0; i < count; i++) {
      const t = ((time / 800 + i / count) % 1);
      const spread = (i / count - 0.5) * 1.2;
      const dist = frame.faceHeight * (0.3 + t * 1.4);
      // emit downward (toward chin direction) — actually let's emit in the "down" of face = -up
      const dirX = -frame.up.x + spread * frame.right.x;
      const dirY = -frame.up.y + spread * frame.right.y;
      const x = frame.mouthCenter.x + dirX * dist;
      const y = frame.mouthCenter.y + dirY * dist;
      const size = frame.faceWidth * 0.18 * (1 - t * 0.5);
      ctx.globalAlpha = Math.max(0, 1 - t);
      drawEmoji(ctx, emojis[i % emojis.length], x, y, size);
    }
    ctx.globalAlpha = 1;
  };
}

function ambient(emojis: string[], count = 22): Filter["render"] {
  return ({ ctx, frame, time }) => {
    if (!frame) return;
    const cx = frame.center.x;
    const cy = frame.center.y;
    const baseR = frame.headWidth * 0.8;
    for (let i = 0; i < count; i++) {
      const t = ((time / 2200 + i / count) % 1);
      const angle = (i / count) * Math.PI * 2 + time / 4000;
      const r = baseR * (1 + t * 0.6);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r - t * frame.headHeight * 0.4;
      const size = frame.faceWidth * 0.18 * (1 - t * 0.3);
      ctx.globalAlpha = Math.sin(t * Math.PI);
      drawEmoji(ctx, emojis[i % emojis.length], x, y, size);
    }
    ctx.globalAlpha = 1;
  };
}

// --- Vector-drawn (non-emoji) filters for cleaner visuals ---

function drawRoundGlasses(ctx: CanvasRenderingContext2D, frame: FaceFrame, fillColor: string, frameColor = "#111") {
  ctx.save();
  const lensR = frame.faceWidth * 0.18;
  const stroke = Math.max(3, frame.faceWidth * 0.025);
  // Bridge
  ctx.strokeStyle = frameColor;
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(frame.leftEye.x, frame.leftEye.y);
  ctx.lineTo(frame.rightEye.x, frame.rightEye.y);
  ctx.stroke();
  // Lenses
  for (const eye of [frame.leftEye, frame.rightEye]) {
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, lensR, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = stroke;
    ctx.stroke();
  }
  // Side temples
  const tilt = frame.angle;
  ctx.lineWidth = stroke;
  ctx.beginPath();
  ctx.moveTo(frame.leftEye.x + Math.cos(tilt) * lensR, frame.leftEye.y + Math.sin(tilt) * lensR);
  ctx.lineTo(frame.leftEye.x + Math.cos(tilt) * lensR * 2.5, frame.leftEye.y + Math.sin(tilt) * lensR * 2.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(frame.rightEye.x - Math.cos(tilt) * lensR, frame.rightEye.y - Math.sin(tilt) * lensR);
  ctx.lineTo(frame.rightEye.x - Math.cos(tilt) * lensR * 2.5, frame.rightEye.y - Math.sin(tilt) * lensR * 2.5);
  ctx.stroke();
  ctx.restore();
}

function drawCatWhiskers(ctx: CanvasRenderingContext2D, frame: FaceFrame, color = "#1a1a1a") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, frame.faceWidth * 0.012);
  const cx = frame.noseTip.x;
  const cy = frame.noseTip.y;
  // Nose dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, frame.faceWidth * 0.04, frame.faceWidth * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
  // 3 whiskers each side
  for (let side of [-1, 1] as const) {
    for (let i = -1; i <= 1; i++) {
      const startX = cx + side * frame.faceWidth * 0.06;
      const startY = cy + i * frame.faceWidth * 0.04;
      const endX = cx + side * frame.faceWidth * 0.32;
      const endY = startY + i * frame.faceWidth * 0.02;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(
        cx + side * frame.faceWidth * 0.18,
        startY + i * frame.faceWidth * 0.01,
        endX,
        endY,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBlush(ctx: CanvasRenderingContext2D, frame: FaceFrame) {
  ctx.save();
  const r = frame.faceWidth * 0.12;
  for (const cheek of [frame.leftCheek, frame.rightCheek]) {
    const grad = ctx.createRadialGradient(cheek.x, cheek.y, 0, cheek.x, cheek.y, r);
    grad.addColorStop(0, "rgba(255, 100, 130, 0.55)");
    grad.addColorStop(1, "rgba(255, 100, 130, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cheek.x, cheek.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDevilHorns(ctx: CanvasRenderingContext2D, frame: FaceFrame) {
  ctx.save();
  const baseW = frame.faceWidth * 0.12;
  const hornH = frame.faceHeight * 0.4;
  for (const side of [-1, 1] as const) {
    const baseX = frame.forehead.x + frame.right.x * side * frame.faceWidth * 0.25;
    const baseY = frame.forehead.y + frame.right.y * side * frame.faceWidth * 0.25;
    const tipX = baseX + frame.up.x * hornH + frame.right.x * side * frame.faceWidth * 0.1;
    const tipY = baseY + frame.up.y * hornH + frame.right.y * side * frame.faceWidth * 0.1;
    const grad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
    grad.addColorStop(0, "#ff2244");
    grad.addColorStop(1, "#660000");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(baseX - frame.right.x * baseW / 2, baseY - frame.right.y * baseW / 2);
    ctx.lineTo(baseX + frame.right.x * baseW / 2, baseY + frame.right.y * baseW / 2);
    ctx.lineTo(tipX, tipY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawHalo(ctx: CanvasRenderingContext2D, frame: FaceFrame, color = "#ffd700") {
  ctx.save();
  const p = above(frame, frame.faceHeight * 0.45);
  ctx.translate(p.x, p.y);
  ctx.rotate(frame.angle);
  const rx = frame.headWidth * 0.55;
  const ry = frame.headWidth * 0.15;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.lineWidth = Math.max(4, frame.faceWidth * 0.03);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLaserEyes(ctx: CanvasRenderingContext2D, frame: FaceFrame, w: number, h: number) {
  ctx.save();
  for (const eye of [frame.leftEye, frame.rightEye]) {
    const grad = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, frame.faceWidth * 0.08);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,80,80,1)");
    grad.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, frame.faceWidth * 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 30, 30, 0.85)";
    ctx.shadowColor = "#ff2222";
    ctx.shadowBlur = 40;
    ctx.beginPath();
    const beamW = frame.faceWidth * 0.05;
    // Beam going forward (out of screen toward viewer) — fake it by extending horizontally
    ctx.moveTo(eye.x - beamW, eye.y - beamW * 0.5);
    ctx.lineTo(eye.x + beamW, eye.y - beamW * 0.5);
    ctx.lineTo(w * 1.5, eye.y + h * 0.04);
    ctx.lineTo(w * 1.5, eye.y - h * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawTears(ctx: CanvasRenderingContext2D, frame: FaceFrame, time: number) {
  ctx.save();
  ctx.fillStyle = "rgba(80, 180, 255, 0.85)";
  for (const eye of [frame.leftEye, frame.rightEye]) {
    for (let i = 0; i < 3; i++) {
      const t = ((time / 1200 + i / 3) % 1);
      const dropY = eye.y + t * frame.faceHeight * 0.6 + frame.up.y * -1 * 0;
      const x = eye.x + frame.up.x * -1 * (t * frame.faceHeight * 0.6) * 0 + Math.sin(t * 6) * 2;
      const r = frame.faceWidth * 0.025 * (1 - t * 0.3);
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.ellipse(eye.x + Math.sin(t * 6) * 2, dropY, r, r * 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tag x to avoid lint
      void x;
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function colorOverlay(fillStyle: string): Filter["render"] {
  return ({ ctx, width, height }) => {
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };
}

function pixelEffect(): Filter["render"] {
  return ({ ctx, width, height }) => {
    const size = Math.max(8, Math.floor(width / 80));
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.floor(width / size));
    off.height = Math.max(1, Math.floor(height / size));
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.imageSmoothingEnabled = false;
    octx.drawImage(ctx.canvas, 0, 0, off.width, off.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
  };
}

function bwEffect(): Filter["render"] {
  return ({ ctx, width, height }) => {
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);
  };
}

function sepiaEffect(): Filter["render"] {
  return ({ ctx, width, height }) => {
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    }
    ctx.putImageData(img, 0, 0);
  };
}

function vhsEffect(): Filter["render"] {
  return ({ ctx, width, height, time }) => {
    ctx.save();
    // Magenta tint
    ctx.fillStyle = "rgba(255, 0, 180, 0.08)";
    ctx.fillRect(0, 0, width, height);
    // Scanlines
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    const offset = (time / 30) % 4;
    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y + offset, width, 1);
    }
    // Color bleed
    ctx.fillStyle = "rgba(0, 255, 255, 0.06)";
    ctx.fillRect(2, 0, width, height);
    ctx.restore();
  };
}

function glitchEffect(): Filter["render"] {
  return ({ ctx, width, height, time }) => {
    const slices = 5;
    for (let i = 0; i < slices; i++) {
      const y = ((Math.sin(time / 220 + i * 1.7) + 1) / 2) * height;
      const sh = height / slices / 3;
      const dx = Math.sin(time / 100 + i * 3) * 25;
      try {
        const img = ctx.getImageData(0, Math.max(0, y), width, Math.min(sh, height - y));
        ctx.putImageData(img, dx, Math.max(0, y));
      } catch {}
    }
  };
}

// --- THE FILTERS ---

export const FILTERS: Filter[] = [
  // 🐶 ANIMAUX (using full animal emojis as masks centered on face = looks like animal headcrown)
  { id: "dog", name: "Chien", emoji: "🐶", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawEmoji(ctx, "🐶", frame.center.x + frame.up.x * frame.faceHeight * 0.1, frame.center.y + frame.up.y * frame.faceHeight * 0.1, frame.headWidth * 1.55, frame.angle);
  } },
  { id: "cat", name: "Chat", emoji: "🐱", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawEmoji(ctx, "🐱", frame.center.x + frame.up.x * frame.faceHeight * 0.1, frame.center.y + frame.up.y * frame.faceHeight * 0.1, frame.headWidth * 1.55, frame.angle);
    drawCatWhiskers(ctx, frame, "#222");
  } },
  { id: "bunny", name: "Lapin", emoji: "🐰", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawEmoji(ctx, "🐰", frame.center.x + frame.up.x * frame.faceHeight * 0.15, frame.center.y + frame.up.y * frame.faceHeight * 0.15, frame.headWidth * 1.7, frame.angle);
  } },
  { id: "pig", name: "Cochon", emoji: "🐷", category: "animaux", needsFace: true, render: maskFilter("🐷", 1.5) },
  { id: "panda", name: "Panda", emoji: "🐼", category: "animaux", needsFace: true, render: maskFilter("🐼", 1.5) },
  { id: "frog", name: "Grenouille", emoji: "🐸", category: "animaux", needsFace: true, render: maskFilter("🐸", 1.5) },
  { id: "monkey", name: "Singe", emoji: "🐵", category: "animaux", needsFace: true, render: maskFilter("🐵", 1.5) },
  { id: "lion", name: "Lion", emoji: "🦁", category: "animaux", needsFace: true, render: maskFilter("🦁", 1.65) },
  { id: "tiger", name: "Tigre", emoji: "🐯", category: "animaux", needsFace: true, render: maskFilter("🐯", 1.55) },
  { id: "bear", name: "Ours", emoji: "🐻", category: "animaux", needsFace: true, render: maskFilter("🐻", 1.55) },
  { id: "fox", name: "Renard", emoji: "🦊", category: "animaux", needsFace: true, render: maskFilter("🦊", 1.55) },
  { id: "koala", name: "Koala", emoji: "🐨", category: "animaux", needsFace: true, render: maskFilter("🐨", 1.55) },
  { id: "unicorn", name: "Licorne", emoji: "🦄", category: "animaux", needsFace: true, render: maskFilter("🦄", 1.65) },
  { id: "wolf", name: "Loup", emoji: "🐺", category: "animaux", needsFace: true, render: maskFilter("🐺", 1.55) },

  // 👑 CHAPEAUX — emoji placed above the head
  { id: "crown", name: "Couronne", emoji: "👑", category: "chapeaux", needsFace: true, render: hatFilter("👑", 1.2, 0.4) },
  { id: "party", name: "Chapeau fête", emoji: "🎉", category: "chapeaux", needsFace: true, render: hatFilter("🎉", 1.1, 0.45) },
  { id: "santa", name: "Père Noël", emoji: "🎅", category: "chapeaux", needsFace: true, render: hatFilter("🎅", 1.4, 0.3) },
  { id: "cowboy", name: "Cowboy", emoji: "🤠", category: "chapeaux", needsFace: true, render: hatFilter("🤠", 1.5, 0.25) },
  { id: "wizard", name: "Magicien", emoji: "🧙", category: "chapeaux", needsFace: true, render: hatFilter("🧙‍♂️", 1.4, 0.3) },
  { id: "halo", name: "Auréole", emoji: "😇", category: "chapeaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawHalo(ctx, frame);
  } },
  { id: "devil", name: "Cornes du diable", emoji: "😈", category: "chapeaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawDevilHorns(ctx, frame);
  } },
  { id: "graduation", name: "Diplômé", emoji: "🎓", category: "chapeaux", needsFace: true, render: hatFilter("🎓", 1.3, 0.35) },
  { id: "tophat", name: "Haut-de-forme", emoji: "🎩", category: "chapeaux", needsFace: true, render: hatFilter("🎩", 1.25, 0.4) },

  // 😎 LUNETTES (mostly drawn shapes for cleaner look)
  { id: "sunglasses", name: "Soleil", emoji: "🕶️", category: "lunettes", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawRoundGlasses(ctx, frame, "rgba(20,20,30,0.85)");
  } },
  { id: "round-red", name: "Rouge round", emoji: "👓", category: "lunettes", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawRoundGlasses(ctx, frame, "rgba(255, 80, 80, 0.65)", "#aa0000");
  } },
  { id: "round-blue", name: "Bleu round", emoji: "🔵", category: "lunettes", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawRoundGlasses(ctx, frame, "rgba(80, 130, 255, 0.55)", "#0040aa");
  } },
  { id: "3d", name: "3D ciné", emoji: "🥽", category: "lunettes", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    ctx.save();
    const lensR = frame.faceWidth * 0.2;
    const stroke = Math.max(3, frame.faceWidth * 0.025);
    ctx.lineWidth = stroke;
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(frame.leftEye.x, frame.leftEye.y);
    ctx.lineTo(frame.rightEye.x, frame.rightEye.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(frame.leftEye.x, frame.leftEye.y, lensR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,30,30,0.6)";
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(frame.rightEye.x, frame.rightEye.y, lensR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(30,120,255,0.6)";
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } },
  { id: "monocle", name: "Monocle", emoji: "🧐", category: "lunettes", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    ctx.save();
    const r = frame.faceWidth * 0.2;
    const stroke = Math.max(4, frame.faceWidth * 0.03);
    ctx.lineWidth = stroke;
    ctx.strokeStyle = "#222";
    ctx.beginPath();
    ctx.arc(frame.rightEye.x, frame.rightEye.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Chain
    ctx.beginPath();
    ctx.moveTo(frame.rightEye.x + Math.cos(frame.angle) * r, frame.rightEye.y + Math.sin(frame.angle) * r);
    ctx.lineTo(frame.rightCheek.x, frame.rightCheek.y);
    ctx.stroke();
    ctx.restore();
  } },
  { id: "nerd", name: "Nerd", emoji: "🤓", category: "lunettes", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawRoundGlasses(ctx, frame, "rgba(220,220,255,0.25)", "#000");
  } },
  { id: "dealwithit", name: "Deal With It", emoji: "🕶️", category: "lunettes", needsFace: true, render: ({ ctx, frame, time }) => {
    if (!frame) return;
    // animate down from top
    const lifetime = 1500;
    const t = Math.min(1, (time % 10000) / lifetime);
    const yOffset = (1 - t) * -frame.faceHeight * 0.8;
    ctx.save();
    ctx.translate(0, yOffset);
    // pixel-style square glasses
    const w = frame.faceWidth * 0.35;
    const h = frame.faceWidth * 0.12;
    ctx.fillStyle = "#000";
    for (const eye of [frame.leftEye, frame.rightEye]) {
      ctx.save();
      ctx.translate(eye.x, eye.y);
      ctx.rotate(frame.angle);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    // Bridge
    ctx.fillRect(
      Math.min(frame.leftEye.x, frame.rightEye.x) + w / 2,
      (frame.leftEye.y + frame.rightEye.y) / 2 - h * 0.15,
      Math.abs(frame.leftEye.x - frame.rightEye.x) - w,
      h * 0.3,
    );
    ctx.restore();
  } },

  // 🤡 PERSONNAGES
  { id: "clown", name: "Clown", emoji: "🤡", category: "personnages", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    // Red nose
    ctx.save();
    const r = frame.faceWidth * 0.08;
    const grad = ctx.createRadialGradient(frame.noseTip.x - r * 0.3, frame.noseTip.y - r * 0.3, 0, frame.noseTip.x, frame.noseTip.y, r);
    grad.addColorStop(0, "#ff8888");
    grad.addColorStop(1, "#cc0000");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(frame.noseTip.x, frame.noseTip.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Big cheeks
    drawBlush(ctx, frame);
  } },
  { id: "zombie", name: "Zombie", emoji: "🧟", category: "personnages", needsFace: false, render: ({ ctx, width, height }) => {
    ctx.save();
    ctx.fillStyle = "rgba(60, 130, 60, 0.35)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } },
  { id: "vampire", name: "Vampire", emoji: "🧛", category: "personnages", needsFace: true, render: ({ ctx, frame, width, height }) => {
    if (!frame) return;
    ctx.save();
    ctx.fillStyle = "rgba(80, 0, 30, 0.25)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    drawEmoji(ctx, "🧛", frame.center.x, frame.center.y - frame.faceHeight * 0.6, frame.headWidth * 0.8, frame.angle);
  } },
  { id: "ghost", name: "Fantôme", emoji: "👻", category: "personnages", needsFace: false, render: colorOverlay("rgba(220, 220, 255, 0.4)") },
  { id: "skull", name: "Squelette", emoji: "💀", category: "personnages", needsFace: true, render: maskFilter("💀", 1.5) },
  { id: "robot", name: "Robot", emoji: "🤖", category: "personnages", needsFace: true, render: maskFilter("🤖", 1.5) },
  { id: "alien", name: "Alien", emoji: "👽", category: "personnages", needsFace: true, render: maskFilter("👽", 1.5) },
  { id: "tears", name: "En larmes", emoji: "😢", category: "personnages", needsFace: true, render: ({ ctx, frame, time }) => {
    if (!frame) return;
    drawTears(ctx, frame, time);
  } },
  { id: "blush", name: "Timide", emoji: "😊", category: "personnages", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawBlush(ctx, frame);
  } },

  // 🔥 ÉPIQUES
  { id: "laser-eyes", name: "Yeux laser", emoji: "🔴", category: "epique", needsFace: true, render: ({ ctx, frame, width, height }) => {
    if (!frame) return;
    drawLaserEyes(ctx, frame, width, height);
  } },
  { id: "fire-eyes", name: "Yeux feu", emoji: "🔥", category: "epique", needsFace: true, render: eyesFilter("🔥", 0.3) },
  { id: "heart-eyes", name: "Yeux cœur", emoji: "😍", category: "epique", needsFace: true, render: eyesFilter("❤️", 0.3) },
  { id: "star-eyes", name: "Yeux étoile", emoji: "🤩", category: "epique", needsFace: true, render: eyesFilter("⭐", 0.3) },
  { id: "dollar-eyes", name: "Yeux dollar", emoji: "🤑", category: "epique", needsFace: true, render: eyesFilter("💲", 0.3) },
  { id: "rainbow-mouth", name: "Arc-en-ciel", emoji: "🌈", category: "epique", needsFace: true, render: mouthEmitter(["🌈", "✨", "💖", "⭐", "💜", "💚"]) },
  { id: "fire-mouth", name: "Cracher feu", emoji: "🔥", category: "epique", needsFace: true, render: mouthEmitter(["🔥", "💥", "🟠"]) },
  { id: "flame-crown", name: "Couronne flamme", emoji: "👑", category: "epique", needsFace: true, render: ({ ctx, frame, time }) => {
    if (!frame) return;
    // 5 flames in arc above forehead
    const count = 5;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1) - 0.5; // -0.5..0.5
      const flick = Math.sin(time / 80 + i) * 0.05;
      const base = {
        x: frame.topOfHead.x + frame.right.x * t * frame.headWidth * 0.8,
        y: frame.topOfHead.y + frame.right.y * t * frame.headWidth * 0.8,
      };
      const size = frame.faceWidth * (0.35 + flick);
      drawEmoji(ctx, "🔥", base.x, base.y, size, frame.angle);
    }
  } },
  { id: "aura", name: "Aura", emoji: "✨", category: "epique", needsFace: true, render: ({ ctx, frame, width, height, time }) => {
    if (!frame) return;
    ctx.save();
    const pulse = (Math.sin(time / 400) + 1) / 2;
    const grad = ctx.createRadialGradient(
      frame.center.x, frame.center.y, frame.faceWidth * 0.5,
      frame.center.x, frame.center.y, frame.faceWidth * (1.8 + pulse * 0.3),
    );
    grad.addColorStop(0, "rgba(255, 220, 100, 0)");
    grad.addColorStop(0.5, `rgba(255, 200, 80, ${0.5 + pulse * 0.3})`);
    grad.addColorStop(1, "rgba(255, 100, 200, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } },
  { id: "neon-halo", name: "Halo néon", emoji: "💫", category: "epique", needsFace: true, render: ({ ctx, frame, time }) => {
    if (!frame) return;
    ctx.save();
    const p = above(frame, frame.faceHeight * 0.4);
    ctx.translate(p.x, p.y);
    ctx.rotate(frame.angle);
    const hue = (time / 20) % 360;
    ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 30;
    ctx.lineWidth = Math.max(5, frame.faceWidth * 0.04);
    ctx.beginPath();
    ctx.ellipse(0, 0, frame.headWidth * 0.6, frame.headWidth * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } },
  { id: "lightning", name: "Éclairs", emoji: "⚡", category: "epique", needsFace: true, render: ({ ctx, frame, time }) => {
    if (!frame) return;
    const count = 4;
    for (let i = 0; i < count; i++) {
      const phase = ((time / 600 + i / count) % 1);
      const angle = (i / count) * Math.PI * 2 + time / 1500;
      const r = frame.headWidth * (0.9 + phase * 0.4);
      const x = frame.center.x + Math.cos(angle) * r;
      const y = frame.center.y + Math.sin(angle) * r;
      ctx.globalAlpha = Math.sin(phase * Math.PI);
      drawEmoji(ctx, "⚡", x, y, frame.faceWidth * 0.35);
    }
    ctx.globalAlpha = 1;
  } },

  // 👽 DÉFORMATIONS
  { id: "big-eyes", name: "Gros yeux", emoji: "👀", category: "deformations", needsFace: true, render: eyesFilter("👁️", 0.4) },
  { id: "alien-eyes", name: "Yeux alien", emoji: "🛸", category: "deformations", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    ctx.save();
    for (const eye of [frame.leftEye, frame.rightEye]) {
      const rx = frame.faceWidth * 0.1;
      const ry = frame.faceWidth * 0.18;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(eye.x, eye.y, rx, ry, frame.angle, 0, Math.PI * 2);
      ctx.fill();
      // highlight
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.ellipse(eye.x - rx * 0.3, eye.y - ry * 0.4, rx * 0.25, ry * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } },
  { id: "baby", name: "Bébé", emoji: "👶", category: "deformations", needsFace: true, render: maskFilter("👶", 1.5) },
  { id: "old", name: "Vieillard", emoji: "👴", category: "deformations", needsFace: true, render: maskFilter("👴", 1.5) },
  { id: "cartoon", name: "Cartoon", emoji: "🎨", category: "deformations", needsFace: false, render: ({ ctx, width, height }) => {
    ctx.save();
    ctx.fillStyle = "rgba(255, 230, 100, 0.18)";
    ctx.fillRect(0, 0, width, height);
    // saturation boost via tint
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(255, 150, 100, 0.4)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } },
  { id: "pixel", name: "Pixel", emoji: "🟫", category: "deformations", needsFace: false, render: pixelEffect() },

  // ✨ AMBIANCE
  { id: "hearts", name: "Pluie de cœurs", emoji: "❤️", category: "ambiance", needsFace: true, render: ambient(["❤️", "💕", "💖", "💗"]) },
  { id: "stars", name: "Étoiles", emoji: "⭐", category: "ambiance", needsFace: true, render: ambient(["⭐", "✨", "🌟", "💫"]) },
  { id: "butterflies", name: "Papillons", emoji: "🦋", category: "ambiance", needsFace: true, render: ambient(["🦋"], 14) },
  { id: "petals", name: "Pétales", emoji: "🌸", category: "ambiance", needsFace: true, render: ambient(["🌸", "🌺", "🌷", "🌻"], 16) },
  { id: "bubbles", name: "Bulles", emoji: "🫧", category: "ambiance", needsFace: true, render: ambient(["🫧", "💧"], 16) },
  { id: "snow", name: "Neige", emoji: "❄️", category: "ambiance", needsFace: true, render: ambient(["❄️", "❅", "❆"], 22) },
  { id: "confetti", name: "Confettis", emoji: "🎊", category: "ambiance", needsFace: true, render: ambient(["🎊", "🎉", "✨"], 22) },
  { id: "fireworks", name: "Feu d'artifice", emoji: "🎆", category: "ambiance", needsFace: true, render: ambient(["🎆", "🎇", "✨"], 14) },
  { id: "fire-rain", name: "Pluie de feu", emoji: "🔥", category: "ambiance", needsFace: true, render: ambient(["🔥", "💥"], 14) },
  { id: "money", name: "Pluie d'argent", emoji: "💵", category: "ambiance", needsFace: true, render: ambient(["💵", "💴", "💰"], 14) },

  // 🎨 COULEUR
  { id: "bw", name: "Noir & Blanc", emoji: "⚫", category: "couleur", needsFace: false, render: bwEffect() },
  { id: "sepia", name: "Sépia", emoji: "🟫", category: "couleur", needsFace: false, render: sepiaEffect() },
  { id: "vhs", name: "VHS 90's", emoji: "📼", category: "couleur", needsFace: false, render: vhsEffect() },
  { id: "glitch", name: "Glitch", emoji: "📺", category: "couleur", needsFace: false, render: glitchEffect() },
  { id: "neon", name: "Néon cyber", emoji: "🌃", category: "couleur", needsFace: false, render: ({ ctx, width, height }) => {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "rgba(255, 0, 200, 0.25)");
    grad.addColorStop(1, "rgba(0, 220, 255, 0.25)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } },
  { id: "anime", name: "Anime", emoji: "🌸", category: "couleur", needsFace: false, render: colorOverlay("rgba(255, 200, 220, 0.2)") },
  { id: "sunset", name: "Sunset", emoji: "🌇", category: "couleur", needsFace: false, render: ({ ctx, width, height }) => {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(255, 150, 50, 0.25)");
    grad.addColorStop(1, "rgba(200, 50, 100, 0.15)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } },
  { id: "matrix", name: "Matrix", emoji: "💚", category: "couleur", needsFace: false, render: ({ ctx, width, height }) => {
    ctx.save();
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = 0;
      d[i + 1] = g;
      d[i + 2] = 0;
    }
    ctx.putImageData(img, 0, 0);
    ctx.restore();
  } },
];

export const NO_FILTER: Filter = {
  id: "none",
  name: "Aucun",
  emoji: "🚫",
  category: "animaux",
  needsFace: false,
  render: () => {},
};

export function getFiltersByCategory(cat: FilterCategory) {
  return FILTERS.filter(f => f.category === cat);
}

export function findFilter(id: string): Filter | undefined {
  if (id === "none") return NO_FILTER;
  return FILTERS.find(f => f.id === id);
}
