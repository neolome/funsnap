import { getEmojiImage } from "./twemoji";

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
  faceWidth: number;
  faceHeight: number;
  headWidth: number;
  headHeight: number;
  angle: number;
  up: { x: number; y: number };
  right: { x: number; y: number };
  mouthOpen: number;
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
  needsFace: boolean;
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
  const angle = Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x);
  const upVec = { x: (forehead.x - chin.x) / faceHeight, y: (forehead.y - chin.y) / faceHeight };
  const rightVec = { x: Math.cos(angle), y: Math.sin(angle) };
  const headWidth = faceWidth * 1.3;
  const headHeight = faceHeight * 1.6;
  const topOfHead = {
    x: forehead.x + upVec.x * faceHeight * 0.35,
    y: forehead.y + upVec.y * faceHeight * 0.35,
  };
  const center = { x: (forehead.x + chin.x) / 2, y: (forehead.y + chin.y) / 2 };
  const eyeCenter = { x: (leftEyeC.x + rightEyeC.x) / 2, y: (leftEyeC.y + rightEyeC.y) / 2 };
  const mouthCenter = { x: (upperLip.x + lowerLip.x) / 2, y: (upperLip.y + lowerLip.y) / 2 };
  const mouthGap = Math.hypot(upperLip.x - lowerLip.x, upperLip.y - lowerLip.y);
  const mouthOpen = Math.min(1, mouthGap / (faceHeight * 0.18));

  return {
    center, forehead, chin, noseTip,
    leftEye: leftEyeC, rightEye: rightEyeC, eyeCenter,
    mouthCenter, mouthLeft, mouthRight,
    leftCheek, rightCheek, topOfHead,
    faceWidth, faceHeight, headWidth, headHeight,
    angle, up: upVec, right: rightVec, mouthOpen,
  };
}

// --- Drawing primitives ---

/** Draw a Twemoji image centered at (x,y), sized so the visible glyph is ~size px. */
function drawTwemoji(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number,
  y: number,
  size: number,
  rotation = 0,
) {
  const img = getEmojiImage(emoji);
  if (!img) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function above(f: FaceFrame, offset: number): Point {
  return { x: f.topOfHead.x + f.up.x * offset, y: f.topOfHead.y + f.up.y * offset };
}

function sideOfHead(f: FaceFrame, side: -1 | 1, upOffset: number, lateralFactor = 0.5): Point {
  const cx = f.topOfHead.x;
  const cy = f.topOfHead.y;
  const dist = f.headWidth * lateralFactor;
  return {
    x: cx + f.right.x * side * dist + f.up.x * upOffset,
    y: cy + f.right.y * side * dist + f.up.y * upOffset,
  };
}

// --- Drawn animal parts (vector shapes — much sharper than emojis) ---

function drawDogEars(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  for (const side of [-1, 1] as const) {
    const base = sideOfHead(f, side, -f.faceHeight * 0.05, 0.4);
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.rotate(f.angle + side * 0.25);
    const w = f.faceWidth * 0.22;
    const h = f.faceHeight * 0.5;
    // Outer ear (floppy)
    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, "#8b5a2b");
    grad.addColorStop(0.6, "#5c3a1a");
    grad.addColorStop(1, "#3a2410");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.1, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    // Inner ear (lighter)
    ctx.fillStyle = "rgba(255, 180, 140, 0.85)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.15, w * 0.55, h * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawCatEars(ctx: CanvasRenderingContext2D, f: FaceFrame, color = "#000") {
  ctx.save();
  for (const side of [-1, 1] as const) {
    const base = sideOfHead(f, side, f.faceHeight * 0.05, 0.35);
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.rotate(f.angle + side * 0.1);
    const w = f.faceWidth * 0.18;
    const h = f.faceHeight * 0.4;
    // Outer triangle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(side * w * 0.4, -h);
    ctx.closePath();
    ctx.fill();
    // Inner pink
    ctx.fillStyle = "#ff9bb3";
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, h * 0.4);
    ctx.lineTo(w * 0.5, h * 0.4);
    ctx.lineTo(side * w * 0.25, -h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawCatWhiskers(ctx: CanvasRenderingContext2D, f: FaceFrame, color = "#1a1a1a") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, f.faceWidth * 0.012);
  const cx = f.noseTip.x;
  const cy = f.noseTip.y;
  // Triangular black nose
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + f.faceWidth * 0.04);
  ctx.lineTo(cx - f.faceWidth * 0.04, cy - f.faceWidth * 0.01);
  ctx.lineTo(cx + f.faceWidth * 0.04, cy - f.faceWidth * 0.01);
  ctx.closePath();
  ctx.fill();
  // Whiskers (3 per side)
  for (const side of [-1, 1] as const) {
    for (let i = -1; i <= 1; i++) {
      const startX = cx + side * f.faceWidth * 0.08;
      const startY = cy + i * f.faceWidth * 0.03;
      const endX = cx + side * f.faceWidth * 0.35;
      const endY = startY + i * f.faceWidth * 0.025;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(cx + side * f.faceWidth * 0.2, startY, endX, endY);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBunnyEars(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  for (const side of [-1, 1] as const) {
    const base = sideOfHead(f, side, f.faceHeight * 0.05, 0.22);
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.rotate(f.angle + side * 0.12);
    const w = f.faceWidth * 0.1;
    const h = f.faceHeight * 0.75;
    // Outer white
    ctx.fillStyle = "#fafafa";
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.3, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    // Inner pink
    ctx.fillStyle = "#ffa3c3";
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.3, w * 0.55, h * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawPandaEars(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  for (const side of [-1, 1] as const) {
    const base = sideOfHead(f, side, f.faceHeight * 0.02, 0.42);
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.arc(base.x, base.y, f.faceWidth * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPandaEyes(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  ctx.fillStyle = "#0a0a0a";
  for (const eye of [f.leftEye, f.rightEye]) {
    ctx.beginPath();
    ctx.ellipse(eye.x, eye.y, f.faceWidth * 0.09, f.faceWidth * 0.12, f.angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBearEars(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  for (const side of [-1, 1] as const) {
    const base = sideOfHead(f, side, f.faceHeight * 0.02, 0.4);
    ctx.fillStyle = "#6b3e1f";
    ctx.beginPath();
    ctx.arc(base.x, base.y, f.faceWidth * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a87045";
    ctx.beginPath();
    ctx.arc(base.x, base.y, f.faceWidth * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFoxEars(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  for (const side of [-1, 1] as const) {
    const base = sideOfHead(f, side, f.faceHeight * 0.05, 0.35);
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.rotate(f.angle + side * 0.15);
    const w = f.faceWidth * 0.14;
    const h = f.faceHeight * 0.42;
    ctx.fillStyle = "#e67e22";
    ctx.beginPath();
    ctx.moveTo(-w, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(side * w * 0.3, -h);
    ctx.closePath();
    ctx.fill();
    // Black tip
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, -h * 0.2);
    ctx.lineTo(w * 0.35, -h * 0.2);
    ctx.lineTo(side * w * 0.3, -h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawLionMane(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  const cx = f.center.x;
  const cy = f.center.y;
  // Outer fluffy ring
  ctx.fillStyle = "#b8702a";
  const spikes = 24;
  const baseR = f.headWidth * 0.62;
  const tipR = f.headWidth * 0.85;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? tipR : baseR;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // Inner darker
  ctx.fillStyle = "#8a5418";
  ctx.beginPath();
  ctx.arc(cx, cy, f.headWidth * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTigerStripes(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  ctx.fillStyle = "rgba(20,15,10,0.85)";
  // Forehead stripes
  for (let i = -2; i <= 2; i++) {
    const cx = f.forehead.x + f.right.x * i * f.faceWidth * 0.08;
    const cy = f.forehead.y + f.right.y * i * f.faceWidth * 0.08;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(f.angle + Math.PI / 2);
    ctx.fillRect(-f.faceWidth * 0.015, -f.faceHeight * 0.06, f.faceWidth * 0.03, f.faceHeight * 0.12);
    ctx.restore();
  }
  // Cheek stripes
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 3; i++) {
      const cx = f.center.x + f.right.x * side * f.faceWidth * (0.3 + i * 0.06);
      const cy = f.center.y + f.right.y * side * f.faceWidth * (0.3 + i * 0.06);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(f.angle + Math.PI / 6);
      ctx.fillRect(-f.faceWidth * 0.015, -f.faceHeight * 0.04, f.faceWidth * 0.03, f.faceHeight * 0.08);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawPigSnout(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  ctx.translate(f.noseTip.x, f.noseTip.y);
  ctx.rotate(f.angle);
  const w = f.faceWidth * 0.22;
  const h = f.faceWidth * 0.16;
  // Pink snout
  const grad = ctx.createRadialGradient(0, -h * 0.2, 0, 0, 0, w);
  grad.addColorStop(0, "#ffc0d0");
  grad.addColorStop(1, "#e88aa6");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  // Two nostrils
  ctx.fillStyle = "#9a4d6a";
  ctx.beginPath();
  ctx.ellipse(-w * 0.35, 0, w * 0.1, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.35, 0, w * 0.1, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPigEars(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  for (const side of [-1, 1] as const) {
    const base = sideOfHead(f, side, f.faceHeight * 0.05, 0.4);
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.rotate(f.angle + side * 0.3);
    ctx.fillStyle = "#ffc0d0";
    ctx.beginPath();
    ctx.moveTo(-f.faceWidth * 0.07, 0);
    ctx.lineTo(f.faceWidth * 0.07, 0);
    ctx.lineTo(side * f.faceWidth * 0.04, -f.faceHeight * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawUnicornHorn(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  const base = above(f, f.faceHeight * 0.02);
  const tip = above(f, f.faceHeight * 0.5);
  ctx.translate(base.x, base.y);
  ctx.rotate(f.angle);
  const w = f.faceWidth * 0.08;
  const h = Math.hypot(tip.x - base.x, tip.y - base.y);
  // Gold gradient
  const grad = ctx.createLinearGradient(0, 0, 0, -h);
  grad.addColorStop(0, "#ffd700");
  grad.addColorStop(0.5, "#ffec80");
  grad.addColorStop(1, "#fffae0");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(0, -h);
  ctx.closePath();
  ctx.fill();
  // Spiral lines
  ctx.strokeStyle = "rgba(150, 100, 0, 0.6)";
  ctx.lineWidth = Math.max(1, f.faceWidth * 0.006);
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5;
    const y = -h * t;
    const ww = w * (1 - t);
    ctx.beginPath();
    ctx.moveTo(-ww, y);
    ctx.quadraticCurveTo(0, y + h * 0.04, ww, y);
    ctx.stroke();
  }
  ctx.restore();
}

// --- Glasses / face accessories (existing, kept) ---

function drawRoundGlasses(ctx: CanvasRenderingContext2D, f: FaceFrame, fill: string, frameColor = "#111") {
  ctx.save();
  const lensR = f.faceWidth * 0.18;
  const stroke = Math.max(3, f.faceWidth * 0.025);
  ctx.strokeStyle = frameColor;
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(f.leftEye.x, f.leftEye.y);
  ctx.lineTo(f.rightEye.x, f.rightEye.y);
  ctx.stroke();
  for (const eye of [f.leftEye, f.rightEye]) {
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, lensR, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = stroke;
    ctx.stroke();
  }
  const tilt = f.angle;
  ctx.lineWidth = stroke;
  ctx.beginPath();
  ctx.moveTo(f.leftEye.x + Math.cos(tilt) * lensR, f.leftEye.y + Math.sin(tilt) * lensR);
  ctx.lineTo(f.leftEye.x + Math.cos(tilt) * lensR * 2.4, f.leftEye.y + Math.sin(tilt) * lensR * 2.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(f.rightEye.x - Math.cos(tilt) * lensR, f.rightEye.y - Math.sin(tilt) * lensR);
  ctx.lineTo(f.rightEye.x - Math.cos(tilt) * lensR * 2.4, f.rightEye.y - Math.sin(tilt) * lensR * 2.4);
  ctx.stroke();
  ctx.restore();
}

function drawBlush(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  const r = f.faceWidth * 0.13;
  for (const cheek of [f.leftCheek, f.rightCheek]) {
    const grad = ctx.createRadialGradient(cheek.x, cheek.y, 0, cheek.x, cheek.y, r);
    grad.addColorStop(0, "rgba(255, 100, 130, 0.6)");
    grad.addColorStop(1, "rgba(255, 100, 130, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cheek.x, cheek.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDevilHorns(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  const baseW = f.faceWidth * 0.12;
  const hornH = f.faceHeight * 0.45;
  for (const side of [-1, 1] as const) {
    const baseX = f.forehead.x + f.right.x * side * f.faceWidth * 0.28;
    const baseY = f.forehead.y + f.right.y * side * f.faceWidth * 0.28;
    const tipX = baseX + f.up.x * hornH + f.right.x * side * f.faceWidth * 0.12;
    const tipY = baseY + f.up.y * hornH + f.right.y * side * f.faceWidth * 0.12;
    const grad = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
    grad.addColorStop(0, "#ff2244");
    grad.addColorStop(1, "#660000");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(baseX - f.right.x * baseW / 2, baseY - f.right.y * baseW / 2);
    ctx.lineTo(baseX + f.right.x * baseW / 2, baseY + f.right.y * baseW / 2);
    ctx.lineTo(tipX, tipY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawHalo(ctx: CanvasRenderingContext2D, f: FaceFrame, color = "#ffd700") {
  ctx.save();
  const p = above(f, f.faceHeight * 0.5);
  ctx.translate(p.x, p.y);
  ctx.rotate(f.angle);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.lineWidth = Math.max(5, f.faceWidth * 0.04);
  ctx.beginPath();
  ctx.ellipse(0, 0, f.headWidth * 0.55, f.headWidth * 0.15, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLaserEyes(ctx: CanvasRenderingContext2D, f: FaceFrame, w: number, h: number) {
  ctx.save();
  for (const eye of [f.leftEye, f.rightEye]) {
    const grad = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, f.faceWidth * 0.1);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,80,80,1)");
    grad.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, f.faceWidth * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 40, 40, 0.85)";
    ctx.shadowColor = "#ff2222";
    ctx.shadowBlur = 40;
    ctx.beginPath();
    const beamW = f.faceWidth * 0.05;
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

function drawTears(ctx: CanvasRenderingContext2D, f: FaceFrame, time: number) {
  ctx.save();
  ctx.fillStyle = "rgba(80, 180, 255, 0.85)";
  for (const eye of [f.leftEye, f.rightEye]) {
    for (let i = 0; i < 3; i++) {
      const t = ((time / 1200 + i / 3) % 1);
      const dropY = eye.y + t * f.faceHeight * 0.6;
      const r = f.faceWidth * 0.025 * (1 - t * 0.3);
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.ellipse(eye.x + Math.sin(t * 6) * 2, dropY, r, r * 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// --- Generic filter builders (now using Twemoji) ---

function hatFilter(emoji: string, sizeFactor = 1.0, offsetFactor = 0.45): Filter["render"] {
  return ({ ctx, frame }) => {
    if (!frame) return;
    const p = above(frame, frame.faceHeight * offsetFactor);
    drawTwemoji(ctx, emoji, p.x, p.y, frame.headWidth * sizeFactor, frame.angle);
  };
}

function noseFilter(emoji: string, sizeFactor = 0.25): Filter["render"] {
  return ({ ctx, frame }) => {
    if (!frame) return;
    drawTwemoji(ctx, emoji, frame.noseTip.x, frame.noseTip.y, frame.faceWidth * sizeFactor, frame.angle);
  };
}

function eyesFilter(emoji: string, sizeFactor = 0.24): Filter["render"] {
  return ({ ctx, frame }) => {
    if (!frame) return;
    const size = frame.faceWidth * sizeFactor;
    drawTwemoji(ctx, emoji, frame.leftEye.x, frame.leftEye.y, size, frame.angle);
    drawTwemoji(ctx, emoji, frame.rightEye.x, frame.rightEye.y, size, frame.angle);
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
      const dirX = -frame.up.x + spread * frame.right.x;
      const dirY = -frame.up.y + spread * frame.right.y;
      const x = frame.mouthCenter.x + dirX * dist;
      const y = frame.mouthCenter.y + dirY * dist;
      const size = frame.faceWidth * 0.18 * (1 - t * 0.5);
      ctx.globalAlpha = Math.max(0, 1 - t);
      drawTwemoji(ctx, emojis[i % emojis.length], x, y, size);
    }
    ctx.globalAlpha = 1;
  };
}

function ambient(emojis: string[], count = 22): Filter["render"] {
  return ({ ctx, frame, time, width, height }) => {
    const cx = frame ? frame.center.x : width / 2;
    const cy = frame ? frame.center.y : height / 2;
    const baseR = frame ? frame.headWidth * 0.9 : width * 0.35;
    for (let i = 0; i < count; i++) {
      const t = ((time / 2400 + i / count) % 1);
      const angle = (i / count) * Math.PI * 2 + time / 4000;
      const r = baseR * (1 + t * 0.6);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r - t * (frame?.headHeight ?? height * 0.3) * 0.5;
      const size = (frame?.faceWidth ?? width * 0.3) * 0.17 * (1 - t * 0.3);
      ctx.globalAlpha = Math.sin(t * Math.PI);
      drawTwemoji(ctx, emojis[i % emojis.length], x, y, size);
    }
    ctx.globalAlpha = 1;
  };
}

// --- Color grades (CSS filter) ---

function cssFilter(filterStr: string): Filter["render"] {
  return ({ ctx, width, height }) => {
    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.drawImage(ctx.canvas, 0, 0);
    ctx.filter = filterStr;
    ctx.drawImage(off, 0, 0);
    ctx.filter = "none";
  };
}

function colorOverlay(fillStyle: string, blend: GlobalCompositeOperation = "source-over"): Filter["render"] {
  return ({ ctx, width, height }) => {
    ctx.save();
    ctx.globalCompositeOperation = blend;
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

function vhsEffect(): Filter["render"] {
  return ({ ctx, width, height, time }) => {
    ctx.save();
    ctx.fillStyle = "rgba(255, 0, 180, 0.07)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    const offset = (time / 30) % 4;
    for (let y = 0; y < height; y += 4) {
      ctx.fillRect(0, y + offset, width, 1);
    }
    ctx.fillStyle = "rgba(0, 255, 255, 0.05)";
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

function matrixEffect(): Filter["render"] {
  return ({ ctx, width, height }) => {
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = 0;
      d[i + 1] = Math.min(255, g * 1.2);
      d[i + 2] = 0;
    }
    ctx.putImageData(img, 0, 0);
  };
}

// --- THE FILTERS ---

export const FILTERS: Filter[] = [
  // 🐶 ANIMAUX (composed of drawn parts + small emoji nose)
  { id: "dog", name: "Chien", emoji: "🐶", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawDogEars(ctx, frame);
    drawTwemoji(ctx, "🐽", frame.noseTip.x, frame.noseTip.y, frame.faceWidth * 0.28, frame.angle);
    if (frame.mouthOpen > 0.3) {
      drawTwemoji(ctx, "👅", frame.mouthCenter.x, frame.mouthCenter.y + frame.faceHeight * 0.08, frame.faceWidth * 0.22, frame.angle);
    }
  } },
  { id: "cat", name: "Chat", emoji: "🐱", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawCatEars(ctx, frame, "#1a1a1a");
    drawCatWhiskers(ctx, frame);
  } },
  { id: "bunny", name: "Lapin", emoji: "🐰", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawBunnyEars(ctx, frame);
    // small pink heart-shaped nose
    ctx.save();
    ctx.fillStyle = "#ff9bb3";
    ctx.translate(frame.noseTip.x, frame.noseTip.y);
    ctx.rotate(frame.angle);
    const r = frame.faceWidth * 0.035;
    ctx.beginPath();
    ctx.arc(-r * 0.7, -r * 0.2, r, 0, Math.PI * 2);
    ctx.arc(r * 0.7, -r * 0.2, r, 0, Math.PI * 2);
    ctx.moveTo(-r * 1.5, 0);
    ctx.lineTo(r * 1.5, 0);
    ctx.lineTo(0, r * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } },
  { id: "pig", name: "Cochon", emoji: "🐷", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawPigEars(ctx, frame);
    drawPigSnout(ctx, frame);
  } },
  { id: "panda", name: "Panda", emoji: "🐼", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawPandaEars(ctx, frame);
    drawPandaEyes(ctx, frame);
    drawTwemoji(ctx, "⚫", frame.noseTip.x, frame.noseTip.y, frame.faceWidth * 0.1, frame.angle);
  } },
  { id: "bear", name: "Ours", emoji: "🐻", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawBearEars(ctx, frame);
    drawTwemoji(ctx, "🐻", frame.noseTip.x, frame.noseTip.y, frame.faceWidth * 0.32, frame.angle);
  } },
  { id: "fox", name: "Renard", emoji: "🦊", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawFoxEars(ctx, frame);
    drawTwemoji(ctx, "🦊", frame.noseTip.x, frame.noseTip.y, frame.faceWidth * 0.32, frame.angle);
  } },
  { id: "lion", name: "Lion", emoji: "🦁", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawLionMane(ctx, frame);
    drawTwemoji(ctx, "🦁", frame.noseTip.x, frame.noseTip.y, frame.faceWidth * 0.35, frame.angle);
  } },
  { id: "tiger", name: "Tigre", emoji: "🐯", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawTigerStripes(ctx, frame);
    drawCatEars(ctx, frame, "#d97706");
    drawTwemoji(ctx, "🐯", frame.noseTip.x, frame.noseTip.y, frame.faceWidth * 0.3, frame.angle);
  } },
  { id: "monkey", name: "Singe", emoji: "🐵", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    ctx.save();
    for (const side of [-1, 1] as const) {
      const base = sideOfHead(frame, side, 0, 0.5);
      ctx.fillStyle = "#7a4e2b";
      ctx.beginPath();
      ctx.arc(base.x, base.y, frame.faceWidth * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c79870";
      ctx.beginPath();
      ctx.arc(base.x, base.y, frame.faceWidth * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    drawTwemoji(ctx, "🐵", frame.noseTip.x, frame.noseTip.y, frame.faceWidth * 0.3, frame.angle);
  } },
  { id: "frog", name: "Grenouille", emoji: "🐸", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    // Big bulging eyes on top of head
    ctx.save();
    for (const side of [-1, 1] as const) {
      const base = sideOfHead(frame, side, -frame.faceHeight * 0.1, 0.3);
      ctx.fillStyle = "#5fb054";
      ctx.beginPath();
      ctx.arc(base.x, base.y, frame.faceWidth * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(base.x, base.y, frame.faceWidth * 0.085, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(base.x, base.y, frame.faceWidth * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } },
  { id: "koala", name: "Koala", emoji: "🐨", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    ctx.save();
    for (const side of [-1, 1] as const) {
      const base = sideOfHead(frame, side, 0, 0.42);
      ctx.fillStyle = "#888";
      ctx.beginPath();
      ctx.arc(base.x, base.y, frame.faceWidth * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f5f0eb";
      ctx.beginPath();
      ctx.arc(base.x, base.y, frame.faceWidth * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Big black nose
    ctx.save();
    ctx.fillStyle = "#1a1a1a";
    ctx.translate(frame.noseTip.x, frame.noseTip.y);
    ctx.rotate(frame.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, frame.faceWidth * 0.1, frame.faceWidth * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } },
  { id: "unicorn", name: "Licorne", emoji: "🦄", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawUnicornHorn(ctx, frame);
    drawBunnyEars(ctx, frame);
  } },
  { id: "wolf", name: "Loup", emoji: "🐺", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    ctx.save();
    for (const side of [-1, 1] as const) {
      const base = sideOfHead(frame, side, frame.faceHeight * 0.05, 0.35);
      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.rotate(frame.angle + side * 0.1);
      ctx.fillStyle = "#5a5a5a";
      ctx.beginPath();
      ctx.moveTo(-frame.faceWidth * 0.12, frame.faceHeight * 0.15);
      ctx.lineTo(frame.faceWidth * 0.12, frame.faceHeight * 0.15);
      ctx.lineTo(side * frame.faceWidth * 0.05, -frame.faceHeight * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    drawTwemoji(ctx, "🐺", frame.noseTip.x, frame.noseTip.y, frame.faceWidth * 0.3, frame.angle);
  } },

  // 👑 CHAPEAUX
  { id: "crown", name: "Couronne", emoji: "👑", category: "chapeaux", needsFace: true, render: hatFilter("👑", 0.95, 0.45) },
  { id: "party", name: "Chapeau fête", emoji: "🥳", category: "chapeaux", needsFace: true, render: hatFilter("🥳", 0.95, 0.5) },
  { id: "santa", name: "Père Noël", emoji: "🎅", category: "chapeaux", needsFace: true, render: hatFilter("🎅", 1.0, 0.4) },
  { id: "cowboy", name: "Cowboy", emoji: "🤠", category: "chapeaux", needsFace: true, render: hatFilter("🤠", 1.1, 0.35) },
  { id: "wizard", name: "Magicien", emoji: "🧙", category: "chapeaux", needsFace: true, render: hatFilter("🧙", 1.0, 0.4) },
  { id: "graduation", name: "Diplômé", emoji: "🎓", category: "chapeaux", needsFace: true, render: hatFilter("🎓", 1.05, 0.4) },
  { id: "tophat", name: "Haut-de-forme", emoji: "🎩", category: "chapeaux", needsFace: true, render: hatFilter("🎩", 1.0, 0.45) },
  { id: "halo", name: "Auréole", emoji: "😇", category: "chapeaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawHalo(ctx, frame);
  } },
  { id: "devil", name: "Cornes diable", emoji: "😈", category: "chapeaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawDevilHorns(ctx, frame);
  } },

  // 😎 LUNETTES (drawn shapes)
  { id: "sunglasses", name: "Soleil", emoji: "🕶️", category: "lunettes", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawRoundGlasses(ctx, frame, "rgba(15,15,25,0.92)");
  } },
  { id: "round-red", name: "Rouge", emoji: "👓", category: "lunettes", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawRoundGlasses(ctx, frame, "rgba(255, 80, 80, 0.55)", "#990000");
  } },
  { id: "round-blue", name: "Bleu", emoji: "🔵", category: "lunettes", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawRoundGlasses(ctx, frame, "rgba(80, 130, 255, 0.5)", "#003a99");
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
  { id: "nerd", name: "Nerd", emoji: "🤓", category: "lunettes", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawRoundGlasses(ctx, frame, "rgba(220,220,255,0.2)", "#000");
  } },
  { id: "dealwithit", name: "Deal With It", emoji: "😎", category: "lunettes", needsFace: true, render: ({ ctx, frame, time }) => {
    if (!frame) return;
    const lifetime = 1500;
    const t = Math.min(1, (time % 10000) / lifetime);
    const yOffset = (1 - t) * -frame.faceHeight * 0.8;
    ctx.save();
    ctx.translate(0, yOffset);
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
    ctx.fillRect(
      Math.min(frame.leftEye.x, frame.rightEye.x) + w / 2,
      (frame.leftEye.y + frame.rightEye.y) / 2 - h * 0.15,
      Math.abs(frame.leftEye.x - frame.rightEye.x) - w,
      h * 0.3,
    );
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
    ctx.beginPath();
    ctx.moveTo(frame.rightEye.x + Math.cos(frame.angle) * r, frame.rightEye.y + Math.sin(frame.angle) * r);
    ctx.lineTo(frame.rightCheek.x, frame.rightCheek.y);
    ctx.stroke();
    ctx.restore();
  } },

  // 🤡 PERSONNAGES
  { id: "clown", name: "Clown", emoji: "🤡", category: "personnages", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    ctx.save();
    const r = frame.faceWidth * 0.085;
    const grad = ctx.createRadialGradient(frame.noseTip.x - r * 0.3, frame.noseTip.y - r * 0.3, 0, frame.noseTip.x, frame.noseTip.y, r);
    grad.addColorStop(0, "#ff8888");
    grad.addColorStop(1, "#cc0000");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(frame.noseTip.x, frame.noseTip.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawBlush(ctx, frame);
  } },
  { id: "zombie", name: "Zombie", emoji: "🧟", category: "personnages", needsFace: false, render: colorOverlay("rgba(60, 130, 60, 0.4)") },
  { id: "vampire", name: "Vampire", emoji: "🧛", category: "personnages", needsFace: true, render: ({ ctx, frame, width, height }) => {
    if (!frame) return;
    ctx.save();
    ctx.fillStyle = "rgba(80, 0, 30, 0.25)";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    drawTwemoji(ctx, "🧛", frame.center.x, frame.topOfHead.y - frame.faceHeight * 0.3, frame.headWidth * 0.7, frame.angle);
  } },
  { id: "ghost", name: "Fantôme", emoji: "👻", category: "personnages", needsFace: false, render: colorOverlay("rgba(220, 220, 255, 0.4)") },
  { id: "skull", name: "Squelette", emoji: "💀", category: "personnages", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawTwemoji(ctx, "💀", frame.center.x, frame.center.y, frame.headWidth * 1.1, frame.angle);
  } },
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
  { id: "fire-eyes", name: "Yeux feu", emoji: "🔥", category: "epique", needsFace: true, render: eyesFilter("🔥", 0.28) },
  { id: "heart-eyes", name: "Yeux cœur", emoji: "❤️", category: "epique", needsFace: true, render: eyesFilter("❤️", 0.24) },
  { id: "star-eyes", name: "Yeux étoile", emoji: "⭐", category: "epique", needsFace: true, render: eyesFilter("⭐", 0.24) },
  { id: "dollar-eyes", name: "Yeux dollar", emoji: "💲", category: "epique", needsFace: true, render: eyesFilter("💲", 0.24) },
  { id: "rainbow-mouth", name: "Arc-en-ciel", emoji: "🌈", category: "epique", needsFace: true, render: mouthEmitter(["🌈", "✨", "💖", "⭐", "💜", "💚"]) },
  { id: "fire-mouth", name: "Cracher feu", emoji: "🔥", category: "epique", needsFace: true, render: mouthEmitter(["🔥", "💥"]) },
  { id: "flame-crown", name: "Couronne flamme", emoji: "👑", category: "epique", needsFace: true, render: ({ ctx, frame, time }) => {
    if (!frame) return;
    const count = 5;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1) - 0.5;
      const flick = Math.sin(time / 80 + i) * 0.05;
      const base = {
        x: frame.topOfHead.x + frame.right.x * t * frame.headWidth * 0.8,
        y: frame.topOfHead.y + frame.right.y * t * frame.headWidth * 0.8,
      };
      const size = frame.faceWidth * (0.32 + flick);
      drawTwemoji(ctx, "🔥", base.x, base.y, size, frame.angle);
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
    const p = above(frame, frame.faceHeight * 0.45);
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
      drawTwemoji(ctx, "⚡", x, y, frame.faceWidth * 0.3);
    }
    ctx.globalAlpha = 1;
  } },

  // 👽 DÉFORMATIONS
  { id: "big-eyes", name: "Gros yeux", emoji: "👀", category: "deformations", needsFace: true, render: eyesFilter("👁️", 0.32) },
  { id: "alien-eyes", name: "Yeux alien", emoji: "👽", category: "deformations", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    ctx.save();
    for (const eye of [frame.leftEye, frame.rightEye]) {
      const rx = frame.faceWidth * 0.1;
      const ry = frame.faceWidth * 0.18;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(eye.x, eye.y, rx, ry, frame.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.ellipse(eye.x - rx * 0.3, eye.y - ry * 0.4, rx * 0.25, ry * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } },
  { id: "baby", name: "Bébé", emoji: "👶", category: "deformations", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawTwemoji(ctx, "👶", frame.center.x, frame.center.y, frame.headWidth * 1.1, frame.angle);
  } },
  { id: "old", name: "Vieillard", emoji: "👴", category: "deformations", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawTwemoji(ctx, "👴", frame.center.x, frame.center.y, frame.headWidth * 1.1, frame.angle);
  } },
  { id: "cartoon", name: "Cartoon", emoji: "🎨", category: "deformations", needsFace: false, render: cssFilter("saturate(1.8) contrast(1.2)") },
  { id: "pixel", name: "Pixel", emoji: "🟫", category: "deformations", needsFace: false, render: pixelEffect() },
  { id: "blur", name: "Flou", emoji: "🌫️", category: "deformations", needsFace: false, render: cssFilter("blur(8px) saturate(1.2)") },

  // ✨ AMBIANCE
  { id: "hearts", name: "Pluie de cœurs", emoji: "❤️", category: "ambiance", needsFace: true, render: ambient(["❤️", "💕", "💖", "💗"]) },
  { id: "stars", name: "Étoiles", emoji: "⭐", category: "ambiance", needsFace: true, render: ambient(["⭐", "✨", "🌟", "💫"]) },
  { id: "butterflies", name: "Papillons", emoji: "🦋", category: "ambiance", needsFace: true, render: ambient(["🦋"], 14) },
  { id: "petals", name: "Pétales", emoji: "🌸", category: "ambiance", needsFace: true, render: ambient(["🌸", "🌺", "🌷", "🌻"], 16) },
  { id: "bubbles", name: "Bulles", emoji: "🫧", category: "ambiance", needsFace: true, render: ambient(["🫧", "💧"], 16) },
  { id: "snow", name: "Neige", emoji: "❄️", category: "ambiance", needsFace: true, render: ambient(["❄️"], 22) },
  { id: "confetti", name: "Confettis", emoji: "🎊", category: "ambiance", needsFace: true, render: ambient(["🎊", "🎉", "✨"], 22) },
  { id: "fireworks", name: "Feu d'artifice", emoji: "🎆", category: "ambiance", needsFace: true, render: ambient(["🎆", "🎇", "✨"], 14) },
  { id: "fire-rain", name: "Pluie de feu", emoji: "🔥", category: "ambiance", needsFace: true, render: ambient(["🔥", "💥"], 14) },
  { id: "money", name: "Pluie d'argent", emoji: "💵", category: "ambiance", needsFace: true, render: ambient(["💵", "💴", "💰"], 14) },

  // 🎨 COULEUR (CSS filters — clean and pro)
  { id: "bw", name: "Noir & Blanc", emoji: "⚫", category: "couleur", needsFace: false, render: cssFilter("grayscale(1) contrast(1.1)") },
  { id: "sepia", name: "Sépia", emoji: "🟫", category: "couleur", needsFace: false, render: cssFilter("sepia(0.8) saturate(0.8)") },
  { id: "vhs", name: "VHS 90's", emoji: "📼", category: "couleur", needsFace: false, render: vhsEffect() },
  { id: "glitch", name: "Glitch", emoji: "📺", category: "couleur", needsFace: false, render: glitchEffect() },
  { id: "matrix", name: "Matrix", emoji: "💚", category: "couleur", needsFace: false, render: matrixEffect() },
  { id: "neon", name: "Néon cyber", emoji: "🌃", category: "couleur", needsFace: false, render: ({ ctx, width, height }) => {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "rgba(255, 0, 200, 0.25)");
    grad.addColorStop(1, "rgba(0, 220, 255, 0.25)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } },
  { id: "anime", name: "Anime", emoji: "🌸", category: "couleur", needsFace: false, render: cssFilter("saturate(1.6) contrast(1.15) brightness(1.05)") },
  { id: "sunset", name: "Sunset", emoji: "🌇", category: "couleur", needsFace: false, render: ({ ctx, width, height }) => {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(255, 150, 50, 0.25)");
    grad.addColorStop(1, "rgba(200, 50, 100, 0.15)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } },
  { id: "cold", name: "Cold blue", emoji: "🧊", category: "couleur", needsFace: false, render: cssFilter("hue-rotate(-20deg) saturate(1.4) brightness(1.05)") },
  { id: "warm", name: "Warm", emoji: "🔥", category: "couleur", needsFace: false, render: cssFilter("hue-rotate(15deg) saturate(1.3) brightness(1.05)") },
  { id: "dreamy", name: "Dreamy", emoji: "💭", category: "couleur", needsFace: false, render: cssFilter("contrast(0.85) saturate(1.3) brightness(1.1) blur(0.8px)") },
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

/** All emojis used by filters and category icons — used at app boot for preload. */
export function getAllUsedEmojis(): string[] {
  const set = new Set<string>();
  for (const f of FILTERS) set.add(f.emoji);
  for (const c of CATEGORIES) set.add(c.emoji);
  // Also the assets explicitly drawn via drawTwemoji inside render functions:
  ["🐽", "👅", "⚫", "🐻", "🦊", "🦁", "🐯", "🐵", "🐺", "🥳", "🎅", "🤠", "🧙", "🎓", "🎩",
   "💀", "👶", "👴", "🧛", "🔥", "💥", "❤️", "⭐", "💲", "👁️", "🌈", "✨", "💖", "💜", "💚",
   "💕", "💗", "🌟", "💫", "🦋", "🌸", "🌺", "🌷", "🌻", "🫧", "💧", "❄️", "🎊", "🎉", "🎆", "🎇",
   "💵", "💴", "💰", "⚡"].forEach(e => set.add(e));
  return Array.from(set);
}
