import { getEmojiImage } from "./twemoji";

export type FilterCategory =
  | "cambodge"
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
  { id: "cambodge", label: "Cambodge", emoji: "🇰🇭" },
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
  // Compute head tilt from the eye line. ROBUST to whether the source is
  // mirrored or not: always orient from the eye on the LEFT side of the
  // image to the eye on the RIGHT side, so angle = 0 for a level face.
  const eA = leftEye.x <= rightEye.x ? leftEye : rightEye;
  const eB = leftEye.x <= rightEye.x ? rightEye : leftEye;
  const angle = Math.atan2(eB.y - eA.y, eB.x - eA.x);
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
  for (const side of [-1, 1] as const) {
    // Anchor at TOP-CORNER of head, then ear hangs DOWNWARD
    const baseX = f.topOfHead.x + f.right.x * side * f.faceWidth * 0.32;
    const baseY = f.topOfHead.y + f.right.y * side * f.faceWidth * 0.32;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(f.angle + side * 0.3);
    const w = f.faceWidth * 0.13;
    const h = f.faceHeight * 0.55;
    // Outer ear — tall ellipse: top at base (y=0), bottom at y=h
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#9c652d");
    grad.addColorStop(0.5, "#6f3f12");
    grad.addColorStop(1, "#3a1f06");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.5, w, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Outline
    ctx.strokeStyle = "rgba(20, 10, 0, 0.45)";
    ctx.lineWidth = Math.max(1, f.faceWidth * 0.005);
    ctx.stroke();
    // Inner ear — lighter peach, smaller, slightly inset toward the tip
    ctx.fillStyle = "rgba(255, 180, 145, 0.92)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.55, w * 0.55, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawCatEars(ctx: CanvasRenderingContext2D, f: FaceFrame, color = "#222") {
  for (const side of [-1, 1] as const) {
    // Anchor at top of head, ~30% face width from center
    const baseX = f.topOfHead.x + f.right.x * side * f.faceWidth * 0.3 + f.up.x * f.faceHeight * 0.05;
    const baseY = f.topOfHead.y + f.right.y * side * f.faceWidth * 0.3 + f.up.y * f.faceHeight * 0.05;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(f.angle + side * 0.12);
    const w = f.faceWidth * 0.2;
    const h = f.faceHeight * 0.5;
    // Outer triangle (slight curve on the outer edge)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w, h * 0.1);
    ctx.lineTo(w * 0.8, h * 0.05);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.5, side * w * 0.4, -h);
    ctx.quadraticCurveTo(-w * 0.5, -h * 0.5, -w, h * 0.1);
    ctx.closePath();
    ctx.fill();
    // Inner pink
    ctx.fillStyle = "#ff9bb3";
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, h * 0);
    ctx.lineTo(w * 0.55, h * -0.05);
    ctx.lineTo(side * w * 0.25, -h * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawCatWhiskers(ctx: CanvasRenderingContext2D, f: FaceFrame, color = "#0a0a0a") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(3, f.faceWidth * 0.02);
  const cx = f.noseTip.x;
  const cy = f.noseTip.y;
  // Triangular pink-tipped black nose
  const noseSize = f.faceWidth * 0.07;
  ctx.fillStyle = "#ff7799";
  ctx.beginPath();
  ctx.moveTo(cx, cy + noseSize);
  ctx.lineTo(cx - noseSize, cy - noseSize * 0.4);
  ctx.lineTo(cx + noseSize, cy - noseSize * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, f.faceWidth * 0.008);
  ctx.stroke();
  // Vertical line from nose to mouth
  ctx.beginPath();
  ctx.moveTo(cx, cy + noseSize);
  ctx.lineTo(cx, cy + f.faceHeight * 0.08);
  ctx.stroke();
  // Whiskers — 3 per side, thicker and longer
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, f.faceWidth * 0.018);
  for (const side of [-1, 1] as const) {
    for (let i = -1; i <= 1; i++) {
      const startX = cx + side * f.faceWidth * 0.07;
      const startY = cy + i * f.faceWidth * 0.04;
      const endX = cx + side * f.faceWidth * 0.42;
      const endY = startY + i * f.faceWidth * 0.04;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(cx + side * f.faceWidth * 0.22, startY + i * f.faceWidth * 0.005, endX, endY);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBunnyEars(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  for (const side of [-1, 1] as const) {
    // Anchor at top of head, close to center
    const baseX = f.topOfHead.x + f.right.x * side * f.faceWidth * 0.15 - f.up.x * f.faceHeight * 0.05;
    const baseY = f.topOfHead.y + f.right.y * side * f.faceWidth * 0.15 - f.up.y * f.faceHeight * 0.05;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(f.angle + side * 0.18);
    const w = f.faceWidth * 0.1;
    const h = f.faceHeight * 0.95;
    // Outer white with subtle shadow
    const grad = ctx.createLinearGradient(-w, 0, w, 0);
    grad.addColorStop(0, "#dcdcdc");
    grad.addColorStop(0.5, "#ffffff");
    grad.addColorStop(1, "#cfcfcf");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.45, w, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    // Outline
    ctx.strokeStyle = "rgba(80,80,80,0.5)";
    ctx.lineWidth = Math.max(1, f.faceWidth * 0.005);
    ctx.stroke();
    // Inner pink
    ctx.fillStyle = "#ffa3c3";
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.45, w * 0.55, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPandaEars(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  for (const side of [-1, 1] as const) {
    const baseX = f.topOfHead.x + f.right.x * side * f.faceWidth * 0.38;
    const baseY = f.topOfHead.y + f.right.y * side * f.faceWidth * 0.38;
    // Big round black ear
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.arc(baseX, baseY, f.faceWidth * 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Subtle highlight to give depth
    ctx.fillStyle = "rgba(60, 60, 60, 0.4)";
    ctx.beginPath();
    ctx.arc(baseX - f.faceWidth * 0.04, baseY - f.faceWidth * 0.04, f.faceWidth * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPandaEyes(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  // HUGE tilted oval eye patches — the iconic panda feature
  for (const side of [-1, 1] as const) {
    const eye = side === -1 ? f.leftEye : f.rightEye;
    ctx.save();
    ctx.translate(eye.x, eye.y);
    // Tilt the patch — inner edge higher, outer edge lower (like real panda)
    ctx.rotate(f.angle + side * -0.35);
    // Big black oval — extends past the eye toward the cheek
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.ellipse(
      side * f.faceWidth * 0.02, // slight outward shift
      f.faceWidth * 0.05,        // shifted down toward cheek
      f.faceWidth * 0.15,        // half-width
      f.faceWidth * 0.18,        // half-height (taller)
      0, 0, Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }
  // Cute white sclera inside each patch
  ctx.fillStyle = "#ffffff";
  for (const eye of [f.leftEye, f.rightEye]) {
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, f.faceWidth * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  // Black pupils
  ctx.fillStyle = "#000";
  for (const eye of [f.leftEye, f.rightEye]) {
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, f.faceWidth * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
  // White highlight on pupil for cuteness
  ctx.fillStyle = "#fff";
  for (const eye of [f.leftEye, f.rightEye]) {
    ctx.beginPath();
    ctx.arc(eye.x - f.faceWidth * 0.005, eye.y - f.faceWidth * 0.005, f.faceWidth * 0.007, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPandaNose(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  ctx.translate(f.noseTip.x, f.noseTip.y);
  ctx.rotate(f.angle);
  // Big rounded black nose
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.ellipse(0, 0, f.faceWidth * 0.06, f.faceWidth * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.ellipse(-f.faceWidth * 0.015, -f.faceWidth * 0.012, f.faceWidth * 0.015, f.faceWidth * 0.01, 0, 0, Math.PI * 2);
  ctx.fill();
  // Vertical line to mouth
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(2, f.faceWidth * 0.01);
  ctx.beginPath();
  ctx.moveTo(0, f.faceWidth * 0.045);
  ctx.lineTo(0, f.faceHeight * 0.08);
  ctx.stroke();
  ctx.restore();
}

function drawBearEars(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  for (const side of [-1, 1] as const) {
    const baseX = f.topOfHead.x + f.right.x * side * f.faceWidth * 0.38;
    const baseY = f.topOfHead.y + f.right.y * side * f.faceWidth * 0.38;
    // Bigger outer brown
    ctx.fillStyle = "#5a3110";
    ctx.beginPath();
    ctx.arc(baseX, baseY, f.faceWidth * 0.18, 0, Math.PI * 2);
    ctx.fill();
    // Inner lighter brown
    ctx.fillStyle = "#a06530";
    ctx.beginPath();
    ctx.arc(baseX, baseY, f.faceWidth * 0.12, 0, Math.PI * 2);
    ctx.fill();
    // Pink center
    ctx.fillStyle = "rgba(255, 180, 150, 0.55)";
    ctx.beginPath();
    ctx.arc(baseX, baseY, f.faceWidth * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFoxEars(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  for (const side of [-1, 1] as const) {
    const baseX = f.topOfHead.x + f.right.x * side * f.faceWidth * 0.3 + f.up.x * f.faceHeight * 0.06;
    const baseY = f.topOfHead.y + f.right.y * side * f.faceWidth * 0.3 + f.up.y * f.faceHeight * 0.06;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(f.angle + side * 0.18);
    const w = f.faceWidth * 0.15;
    const h = f.faceHeight * 0.52;
    // Outer orange triangle
    const grad = ctx.createLinearGradient(0, 0, 0, -h);
    grad.addColorStop(0, "#e67e22");
    grad.addColorStop(1, "#b85d16");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-w, h * 0.1);
    ctx.quadraticCurveTo(-w * 0.7, -h * 0.4, side * w * 0.3, -h);
    ctx.quadraticCurveTo(w * 0.7, -h * 0.4, w, h * 0.1);
    ctx.closePath();
    ctx.fill();
    // White inner
    ctx.fillStyle = "#f5e8d0";
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, h * 0);
    ctx.quadraticCurveTo(-w * 0.45, -h * 0.35, side * w * 0.2, -h * 0.7);
    ctx.quadraticCurveTo(w * 0.45, -h * 0.35, w * 0.55, h * 0);
    ctx.closePath();
    ctx.fill();
    // Black tip
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, -h * 0.55);
    ctx.lineTo(w * 0.4, -h * 0.55);
    ctx.lineTo(side * w * 0.3, -h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawFoxMask(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  // White / cream patches around the eyes — fox's iconic mask
  ctx.save();
  ctx.fillStyle = "rgba(245, 232, 208, 0.85)";
  for (const eye of [f.leftEye, f.rightEye]) {
    ctx.beginPath();
    ctx.ellipse(eye.x, eye.y + f.faceWidth * 0.02, f.faceWidth * 0.12, f.faceWidth * 0.09, f.angle, 0, Math.PI * 2);
    ctx.fill();
  }
  // White around the muzzle area too
  const muzzleX = f.noseTip.x;
  const muzzleY = (f.noseTip.y + f.mouthCenter.y) / 2;
  ctx.beginPath();
  ctx.ellipse(muzzleX, muzzleY, f.faceWidth * 0.18, f.faceWidth * 0.12, f.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLionMane(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  const cx = f.center.x;
  const cy = f.center.y;
  const innerR = f.headWidth * 0.55; // matches head silhouette — keep face visible
  const baseR = f.headWidth * 0.68;
  const tipR = f.headWidth * 0.95;
  const spikes = 28;
  // Outer mane = spiky ring (donut with inner hole = face stays visible)
  ctx.fillStyle = "#a96518";
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? tipR : baseR;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  // Hole for face
  ctx.moveTo(cx + innerR, cy);
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  // Second darker spiky ring inside the outer ring for depth
  const baseR2 = innerR * 1.02;
  const tipR2 = baseR + (tipR - baseR) * 0.45;
  const spikes2 = 22;
  ctx.fillStyle = "#7a440b";
  ctx.beginPath();
  for (let i = 0; i < spikes2 * 2; i++) {
    const a = (i / (spikes2 * 2)) * Math.PI * 2 - Math.PI / 2 + 0.1;
    const r = i % 2 === 0 ? tipR2 : baseR2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.moveTo(cx + innerR, cy);
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
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

/** Generic animal snout: oval muzzle covering nose+mouth area with a darker nose dot at the top. */
function drawAnimalSnout(
  ctx: CanvasRenderingContext2D,
  f: FaceFrame,
  fur: string,
  nose: string,
) {
  ctx.save();
  // Position snout centered on the nose tip, extending down to the mouth.
  const cx = (f.noseTip.x + f.mouthCenter.x) / 2;
  const cy = (f.noseTip.y + f.mouthCenter.y) / 2;
  ctx.translate(cx, cy);
  ctx.rotate(f.angle);
  const muzzleW = f.faceWidth * 0.32;
  const muzzleH = f.faceHeight * 0.28;
  // Furry muzzle
  const grad = ctx.createRadialGradient(0, 0, muzzleW * 0.2, 0, 0, muzzleW);
  grad.addColorStop(0, fur);
  // darker rim by mixing fur with a translucent black
  grad.addColorStop(1, fur);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, muzzleW, muzzleH, 0, 0, Math.PI * 2);
  ctx.fill();
  // Dark nose (oval black at top of muzzle)
  const noseY = -muzzleH * 0.55;
  ctx.fillStyle = nose;
  ctx.beginPath();
  ctx.ellipse(0, noseY, muzzleW * 0.28, muzzleH * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  // Nose highlight
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.ellipse(-muzzleW * 0.1, noseY - muzzleH * 0.05, muzzleW * 0.07, muzzleH * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // Mouth line — small vertical stroke from nose down to mouth
  ctx.strokeStyle = nose;
  ctx.lineWidth = Math.max(2, f.faceWidth * 0.01);
  ctx.beginPath();
  ctx.moveTo(0, noseY + muzzleH * 0.25);
  ctx.lineTo(0, muzzleH * 0.1);
  ctx.stroke();
  ctx.restore();
}

function drawPigSnout(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  ctx.translate(f.noseTip.x, f.noseTip.y);
  ctx.rotate(f.angle);
  const w = f.faceWidth * 0.32; // bigger
  const h = f.faceWidth * 0.24;
  // Pink snout with gradient
  const grad = ctx.createRadialGradient(0, -h * 0.3, 0, 0, 0, w);
  grad.addColorStop(0, "#ffd5e0");
  grad.addColorStop(0.7, "#ffaac5");
  grad.addColorStop(1, "#d56a90");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  // Outline
  ctx.strokeStyle = "rgba(150, 50, 80, 0.5)";
  ctx.lineWidth = Math.max(1.5, f.faceWidth * 0.006);
  ctx.stroke();
  // Two prominent nostrils
  ctx.fillStyle = "#7a2840";
  ctx.beginPath();
  ctx.ellipse(-w * 0.32, 0, w * 0.13, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.32, 0, w * 0.13, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Highlight on top
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.ellipse(-w * 0.15, -h * 0.45, w * 0.25, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPigEars(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  for (const side of [-1, 1] as const) {
    const baseX = f.topOfHead.x + f.right.x * side * f.faceWidth * 0.3 + f.up.x * f.faceHeight * 0.02;
    const baseY = f.topOfHead.y + f.right.y * side * f.faceWidth * 0.3 + f.up.y * f.faceHeight * 0.02;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(f.angle + side * 0.35);
    const w = f.faceWidth * 0.1;
    const h = f.faceHeight * 0.3;
    // Pink triangle ear
    const grad = ctx.createLinearGradient(0, 0, 0, -h);
    grad.addColorStop(0, "#ffaac5");
    grad.addColorStop(1, "#ff7099");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-w, h * 0.1);
    ctx.quadraticCurveTo(-w * 0.5, -h * 0.5, side * w * 0.3, -h);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.5, w, h * 0.1);
    ctx.closePath();
    ctx.fill();
    // Inner pink darker
    ctx.fillStyle = "#d56a90";
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, h * 0);
    ctx.quadraticCurveTo(-w * 0.3, -h * 0.4, side * w * 0.2, -h * 0.85);
    ctx.quadraticCurveTo(w * 0.3, -h * 0.4, w * 0.55, h * 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
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

// --- CAMBODGE — drawn cultural pieces 🇰🇭 ---

/** Apsara/royal crown: 5 gold spires (Mokot), tallest in middle, lotus-bud tips. */
function drawMokotCrown(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  const base = above(f, f.faceHeight * 0.0);
  ctx.translate(base.x, base.y);
  ctx.rotate(f.angle);

  const goldStops = (g: CanvasGradient) => {
    g.addColorStop(0, "#fff4b8");
    g.addColorStop(0.35, "#ffd34a");
    g.addColorStop(0.75, "#b07000");
    g.addColorStop(1, "#5a3500");
  };

  // Headband at the base (red with gold trim)
  const bandW = f.headWidth * 1.0;
  const bandH = f.faceHeight * 0.12;
  ctx.fillStyle = "#8a1f1f";
  ctx.fillRect(-bandW / 2, -bandH * 0.4, bandW, bandH);
  // Gold trim top/bottom
  ctx.fillStyle = "#ffce4a";
  ctx.fillRect(-bandW / 2, -bandH * 0.4, bandW, bandH * 0.15);
  ctx.fillRect(-bandW / 2, bandH * 0.45, bandW, bandH * 0.15);

  // 5 spires: tallest in middle, smaller outward
  const spires = [
    { x: -2, scale: 0.55 },
    { x: -1, scale: 0.78 },
    { x: 0, scale: 1.0 },
    { x: 1, scale: 0.78 },
    { x: 2, scale: 0.55 },
  ];
  for (const s of spires) {
    const xPos = s.x * f.faceWidth * 0.16;
    const h = f.faceHeight * 0.5 * s.scale;
    const w = f.faceWidth * 0.09 * s.scale;
    const baseY = -bandH * 0.4;

    // Spire body
    const grad = ctx.createLinearGradient(0, baseY - h, 0, baseY);
    goldStops(grad);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(xPos - w, baseY);
    ctx.lineTo(xPos + w, baseY);
    ctx.lineTo(xPos + w * 0.55, baseY - h * 0.55);
    ctx.lineTo(xPos + w * 0.25, baseY - h * 0.75);
    // lotus-bud bulge
    ctx.bezierCurveTo(
      xPos + w * 0.55, baseY - h * 0.85,
      xPos + w * 0.35, baseY - h * 1.0,
      xPos, baseY - h,
    );
    ctx.bezierCurveTo(
      xPos - w * 0.35, baseY - h * 1.0,
      xPos - w * 0.55, baseY - h * 0.85,
      xPos - w * 0.25, baseY - h * 0.75,
    );
    ctx.lineTo(xPos - w * 0.55, baseY - h * 0.55);
    ctx.closePath();
    ctx.fill();
    // Dark outline
    ctx.strokeStyle = "rgba(80, 50, 0, 0.6)";
    ctx.lineWidth = Math.max(1, f.faceWidth * 0.004);
    ctx.stroke();
    // Jewel
    ctx.fillStyle = "#c8181a";
    ctx.beginPath();
    ctx.arc(xPos, baseY - h * 0.4, w * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,200,200,0.7)";
    ctx.beginPath();
    ctx.arc(xPos - w * 0.05, baseY - h * 0.42, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Angkor Wat: 3 visible lotus-bud towers in quincunx (central tallest). */
function drawAngkorTower(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  // base
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h * 0.5);
  // First tier inset
  ctx.lineTo(x - w * 0.4, y - h * 0.55);
  ctx.lineTo(x - w * 0.4, y - h * 0.7);
  ctx.lineTo(x - w * 0.3, y - h * 0.75);
  // bulb up to top
  ctx.bezierCurveTo(
    x - w * 0.3, y - h * 0.92,
    x - w * 0.15, y - h,
    x, y - h,
  );
  ctx.bezierCurveTo(
    x + w * 0.15, y - h,
    x + w * 0.3, y - h * 0.92,
    x + w * 0.3, y - h * 0.75,
  );
  ctx.lineTo(x + w * 0.4, y - h * 0.7);
  ctx.lineTo(x + w * 0.4, y - h * 0.55);
  ctx.lineTo(x + w / 2, y - h * 0.5);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawAngkorWatCrown(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  const base = above(f, f.faceHeight * 0.02);
  ctx.translate(base.x, base.y);
  ctx.rotate(f.angle);
  // Sandstone gradient
  const grad = ctx.createLinearGradient(0, -f.faceHeight * 0.7, 0, 0);
  grad.addColorStop(0, "#e8cf8d");
  grad.addColorStop(0.6, "#a07a3b");
  grad.addColorStop(1, "#4f3414");
  ctx.fillStyle = grad;
  ctx.strokeStyle = "rgba(60, 35, 5, 0.55)";
  ctx.lineWidth = Math.max(1, f.faceWidth * 0.004);
  // Side towers
  drawAngkorTower(ctx, -f.faceWidth * 0.34, 0, f.faceWidth * 0.16, f.faceHeight * 0.48);
  drawAngkorTower(ctx, f.faceWidth * 0.34, 0, f.faceWidth * 0.16, f.faceHeight * 0.48);
  // Central tower (largest)
  drawAngkorTower(ctx, 0, 0, f.faceWidth * 0.22, f.faceHeight * 0.72);
  ctx.restore();
}

/** Bayon stone face effect: heavy stone tint + carved smile lines. */
function drawBayonEffect(ctx: CanvasRenderingContext2D, w: number, h: number, f: FaceFrame | null) {
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d");
  if (!octx) return;
  octx.drawImage(ctx.canvas, 0, 0);
  ctx.filter = "grayscale(0.9) sepia(0.35) contrast(1.5) brightness(0.78)";
  ctx.drawImage(off, 0, 0);
  ctx.filter = "none";
  // Greenish moss tint
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(120, 130, 100, 0.15)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  if (!f) return;
  // Stylized Bayon serene smile curve at mouth
  ctx.save();
  ctx.strokeStyle = "rgba(40, 30, 15, 0.45)";
  ctx.lineWidth = Math.max(2, f.faceWidth * 0.012);
  ctx.lineCap = "round";
  ctx.beginPath();
  const ml = f.mouthLeft;
  const mr = f.mouthRight;
  const mc = f.mouthCenter;
  ctx.moveTo(ml.x - f.faceWidth * 0.03, ml.y);
  ctx.quadraticCurveTo(mc.x, mc.y + f.faceHeight * 0.05, mr.x + f.faceWidth * 0.03, mr.y);
  ctx.stroke();
  ctx.restore();
}

/** A single lotus flower with 8 petals. */
function drawLotusFlower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const petals = 8;
  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.rotate((i / petals) * Math.PI * 2);
    const grad = ctx.createLinearGradient(0, -size * 0.55, 0, 0);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.3, "#ffc8d8");
    grad.addColorStop(1, "#ff5e8a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.32, size * 0.18, size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 30, 80, 0.45)";
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.stroke();
    ctx.restore();
  }
  // Yellow center
  ctx.fillStyle = "#ffe366";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  // stamen dots
  ctx.fillStyle = "#b07a00";
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * size * 0.09, Math.sin(a) * size * 0.09, size * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLotusHalo(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  const count = 9;
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) - 0.5; // -0.5..0.5
    // arc above the head spanning 180°
    const arcAngle = -Math.PI / 2 + t * Math.PI * 0.9;
    const r = f.headWidth * 0.75;
    const x = f.center.x + Math.cos(arcAngle) * r;
    const y = f.center.y + Math.sin(arcAngle) * r * 1.1;
    // skip the one directly behind the face if it would overlap the face
    if (Math.abs(t) < 0.08) continue;
    drawLotusFlower(ctx, x, y, f.faceWidth * 0.14, t * 0.4 + f.angle);
  }
}

/** Krama: traditional red & white checkered headscarf wrapping the forehead. */
function drawKrama(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  ctx.translate(f.forehead.x, f.forehead.y - f.faceHeight * 0.04);
  ctx.rotate(f.angle);

  const w = f.headWidth * 1.15;
  const h = f.faceHeight * 0.2;

  // Background red
  ctx.fillStyle = "#b51e21";
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h / 2);
  ctx.lineTo(w / 2, -h / 2);
  ctx.lineTo(w / 2 + h * 0.1, h / 2);
  ctx.lineTo(-w / 2 - h * 0.1, h / 2);
  ctx.closePath();
  ctx.fill();

  // Checker pattern — clip to band shape
  ctx.save();
  ctx.clip();
  const sq = h / 3.5;
  ctx.fillStyle = "rgba(255, 250, 240, 0.95)";
  for (let x = -w / 2 - sq; x < w / 2 + sq; x += sq * 2) {
    for (let y = -h / 2 - sq; y < h / 2 + sq; y += sq * 2) {
      ctx.fillRect(x + sq, y, sq, sq);
      ctx.fillRect(x, y + sq, sq, sq);
    }
  }
  ctx.restore();

  // Top/bottom dark stripe edges
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.fillRect(-w / 2, -h / 2, w, h * 0.06);
  ctx.fillRect(-w / 2, h / 2 - h * 0.06, w, h * 0.06);

  // Fringe (knotted ends) on right side
  ctx.strokeStyle = "#f5e8d0";
  ctx.lineWidth = Math.max(1.5, f.faceWidth * 0.006);
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * 1.5, -h / 2 + (i / 9) * h);
    ctx.quadraticCurveTo(
      w / 2 + 18 + Math.sin(i * 1.3) * 6,
      (i / 9) * h - h * 0.3,
      w / 2 + 30 + Math.cos(i * 2) * 8,
      h * 0.5 + 6 + (i % 2) * 4,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** Radiant gold Buddha halo behind the head with sun rays. */
function drawBuddhaHalo(ctx: CanvasRenderingContext2D, f: FaceFrame, time: number) {
  ctx.save();
  const cx = f.center.x;
  const cy = f.center.y - f.faceHeight * 0.08;
  const innerR = f.headWidth * 0.6;
  const outerR = f.headWidth * 1.05;
  const rays = 22;
  const rot = (time / 8000) % (Math.PI * 2);

  // Sun-ray polygon (zig-zag between inner and outer radius)
  ctx.fillStyle = "rgba(255, 196, 60, 0.85)";
  ctx.shadowColor = "#ffae00";
  ctx.shadowBlur = 35;
  ctx.beginPath();
  for (let i = 0; i < rays * 2; i++) {
    const a = (i / (rays * 2)) * Math.PI * 2 + rot;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // Inner ring
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 230, 130, 0.5)";
  ctx.beginPath();
  ctx.arc(cx, cy, innerR * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Garuda wings: gold/red mythological wings spreading from sides of head. */
function drawGarudaWings(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  for (const side of [-1, 1] as const) {
    ctx.save();
    const base = {
      x: f.center.x + f.right.x * side * f.headWidth * 0.42,
      y: f.center.y + f.right.y * side * f.headWidth * 0.42,
    };
    ctx.translate(base.x, base.y);
    ctx.rotate(f.angle + side * 0.25);

    const wingW = f.headWidth * 0.85;
    const wingH = f.headHeight * 0.7;

    // Outer red feathered shape
    const grad = ctx.createLinearGradient(0, 0, side * wingW, 0);
    grad.addColorStop(0, "#7a0c0c");
    grad.addColorStop(0.6, "#c8181a");
    grad.addColorStop(1, "#ff7a3a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(side * wingW * 0.3, -wingH * 0.55, side * wingW * 0.85, -wingH * 0.4, side * wingW, -wingH * 0.05);
    ctx.bezierCurveTo(side * wingW * 0.75, wingH * 0.3, side * wingW * 0.35, wingH * 0.45, 0, wingH * 0.2);
    ctx.closePath();
    ctx.fill();

    // Gold feather lines
    ctx.strokeStyle = "rgba(255, 230, 100, 0.85)";
    ctx.lineWidth = Math.max(1.5, f.faceWidth * 0.008);
    ctx.lineCap = "round";
    for (let i = 1; i <= 6; i++) {
      const t = i / 7;
      ctx.beginPath();
      ctx.moveTo(side * wingW * 0.08, wingH * 0.05);
      ctx.quadraticCurveTo(
        side * wingW * t * 0.6,
        -wingH * 0.35 + t * wingH * 0.5,
        side * wingW * t,
        -wingH * 0.05 + t * wingH * 0.25,
      );
      ctx.stroke();
    }

    // Small gold rosettes
    ctx.fillStyle = "#ffd34a";
    for (let i = 0; i < 4; i++) {
      const t = (i + 1) / 5;
      const fx = side * wingW * t * 0.7;
      const fy = -wingH * 0.05 + Math.sin(t * Math.PI) * wingH * 0.1;
      ctx.beginPath();
      ctx.arc(fx, fy, wingW * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

/** Naga: 7-headed serpent crown arching over the head. */
function drawNagaCrown(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  const headCount = 7;
  // Body arc (one solid green band across the top)
  ctx.save();
  ctx.strokeStyle = "#2e7a3e";
  ctx.lineCap = "round";
  ctx.lineWidth = f.faceWidth * 0.1;
  const arcR = f.headWidth * 0.65;
  ctx.beginPath();
  const startA = Math.PI;
  const endA = 0;
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = startA + (endA - startA) * t;
    const ux = Math.cos(f.angle);
    const uy = Math.sin(f.angle);
    const localX = Math.cos(a) * arcR;
    const localY = -Math.abs(Math.sin(a)) * arcR * 0.7;
    const x = f.center.x + localX * ux - localY * uy;
    const y = f.center.y + localX * uy + localY * ux;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Inner lighter highlight
  ctx.strokeStyle = "#5cb86f";
  ctx.lineWidth = f.faceWidth * 0.04;
  ctx.stroke();
  ctx.restore();

  // 7 cobra heads fanning out at the top
  for (let i = 0; i < headCount; i++) {
    const t = (i - (headCount - 1) / 2) / ((headCount - 1) / 2); // -1..1
    const fanAngle = t * (Math.PI * 0.42);
    const headR = f.headWidth * 0.85;
    const localX = Math.sin(fanAngle) * headR;
    const localY = -Math.cos(fanAngle) * headR;
    const ux = Math.cos(f.angle);
    const uy = Math.sin(f.angle);
    const hx = f.center.x + localX * ux - localY * uy;
    const hy = f.center.y + localX * uy + localY * ux;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(f.angle + fanAngle);
    // Cobra hood
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, f.faceWidth * 0.13);
    grad.addColorStop(0, "#7fd393");
    grad.addColorStop(1, "#2e7a3e");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, f.faceWidth * 0.07, f.faceWidth * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.fillStyle = "#fff100";
    ctx.beginPath();
    ctx.arc(0, -f.faceWidth * 0.025, f.faceWidth * 0.018, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(0, -f.faceWidth * 0.025, f.faceWidth * 0.008, 0, Math.PI * 2);
    ctx.fill();
    // Tongue
    ctx.strokeStyle = "#c82626";
    ctx.lineWidth = Math.max(1, f.faceWidth * 0.006);
    ctx.beginPath();
    ctx.moveTo(0, f.faceWidth * 0.08);
    ctx.lineTo(0, f.faceWidth * 0.12);
    ctx.stroke();
    ctx.restore();
  }
}

/** Khmer New Year (Chaul Chnam Thmey) — playful white talc powder on cheeks/forehead/nose. */
function drawKhmerNewYearPowder(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  const rand = (n: number) => (Math.sin(n * 9999 + 1.3) * 10000) % 1;
  const positions: { p: Point; spread: number; count: number }[] = [
    { p: f.leftCheek, spread: 0.25, count: 6 },
    { p: f.rightCheek, spread: 0.25, count: 6 },
    { p: f.forehead, spread: 0.3, count: 5 },
    { p: f.noseTip, spread: 0.12, count: 3 },
    { p: f.chin, spread: 0.2, count: 4 },
  ];
  ctx.save();
  let seed = 0;
  for (const { p, spread, count } of positions) {
    for (let i = 0; i < count; i++) {
      seed++;
      const dx = (rand(seed) - 0.5) * f.faceWidth * spread;
      const dy = (rand(seed + 33) - 0.5) * f.faceWidth * spread;
      const r = f.faceWidth * (0.04 + rand(seed + 71) * 0.07);
      ctx.fillStyle = `rgba(255,255,255,${0.55 + rand(seed + 11) * 0.4})`;
      ctx.beginPath();
      ctx.arc(p.x + dx, p.y + dy, r, 0, Math.PI * 2);
      ctx.fill();
      // satellite splatters
      for (let k = 0; k < 4; k++) {
        seed++;
        const sx = (rand(seed) - 0.5) * r * 4;
        const sy = (rand(seed + 7) - 0.5) * r * 4;
        ctx.fillStyle = `rgba(255,255,255,${0.4 + rand(seed + 41) * 0.4})`;
        ctx.beginPath();
        ctx.arc(p.x + dx + sx, p.y + dy + sy, r * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Cambodian flag face paint: blue/red/blue horizontal stripes with mini Angkor silhouette. */
function drawCambodianFlagPaint(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  ctx.translate(f.center.x, f.center.y);
  ctx.rotate(f.angle);
  const totalW = f.headWidth * 0.65;
  const totalH = f.faceHeight * 0.65;
  const blueH = totalH * 0.25;
  const redH = totalH * 0.5;
  // Top blue
  ctx.fillStyle = "rgba(3, 39, 138, 0.55)";
  ctx.fillRect(-totalW / 2, -totalH / 2, totalW, blueH);
  // Middle red
  ctx.fillStyle = "rgba(206, 17, 38, 0.6)";
  ctx.fillRect(-totalW / 2, -totalH / 2 + blueH, totalW, redH);
  // Bottom blue
  ctx.fillStyle = "rgba(3, 39, 138, 0.55)";
  ctx.fillRect(-totalW / 2, totalH / 2 - blueH, totalW, blueH);
  // White Angkor Wat in middle (simplified 3-tower silhouette)
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const aw = totalW * 0.25;
  const ah = redH * 0.6;
  drawAngkorTower(ctx, -aw, ah * 0.5, aw * 0.55, ah * 0.65);
  drawAngkorTower(ctx, aw, ah * 0.5, aw * 0.55, ah * 0.65);
  drawAngkorTower(ctx, 0, ah * 0.5, aw * 0.7, ah);
  ctx.restore();
}

/** Apsara eye makeup: extended cat-eye liner with pointed corners + bindi-style forehead dot. */
function drawApsaraMakeup(ctx: CanvasRenderingContext2D, f: FaceFrame) {
  ctx.save();
  // Extended eyeliner
  ctx.strokeStyle = "#0c0c0c";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2.5, f.faceWidth * 0.014);
  for (const side of [-1, 1] as const) {
    const eye = side === -1 ? f.leftEye : f.rightEye;
    const outerDir = { x: f.right.x * side, y: f.right.y * side };
    const start = {
      x: eye.x - outerDir.x * f.faceWidth * 0.05,
      y: eye.y - outerDir.y * f.faceWidth * 0.05 - f.up.y * f.faceWidth * 0.01,
    };
    const mid = {
      x: eye.x + outerDir.x * f.faceWidth * 0.1,
      y: eye.y + outerDir.y * f.faceWidth * 0.1 - f.up.y * f.faceWidth * 0.015,
    };
    const tip = {
      x: eye.x + outerDir.x * f.faceWidth * 0.16 + f.up.x * f.faceWidth * 0.04,
      y: eye.y + outerDir.y * f.faceWidth * 0.16 + f.up.y * f.faceWidth * 0.04,
    };
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
    ctx.stroke();
  }
  // Red bindi-style dot between eyes (Khmer/Hindu heritage tilak)
  const tilakX = (f.leftEye.x + f.rightEye.x) / 2 + f.up.x * f.faceHeight * 0.05;
  const tilakY = (f.leftEye.y + f.rightEye.y) / 2 + f.up.y * f.faceHeight * 0.05;
  const r = f.faceWidth * 0.035;
  const grad = ctx.createRadialGradient(tilakX - r * 0.3, tilakY - r * 0.3, 0, tilakX, tilakY, r);
  grad.addColorStop(0, "#ff5566");
  grad.addColorStop(1, "#990012");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(tilakX, tilakY, r, 0, Math.PI * 2);
  ctx.fill();
  // Tiny gold dot on top of red
  ctx.fillStyle = "#ffd34a";
  ctx.beginPath();
  ctx.arc(tilakX - r * 0.2, tilakY - r * 0.2, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- THE FILTERS ---

export const FILTERS: Filter[] = [
  // 🇰🇭 CAMBODGE — cultural filters drawn as vector parts
  { id: "mokot", name: "Mokot Apsara", emoji: "👸", category: "cambodge", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawMokotCrown(ctx, frame);
    drawApsaraMakeup(ctx, frame);
  } },
  { id: "angkor", name: "Angkor Wat", emoji: "🛕", category: "cambodge", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawAngkorWatCrown(ctx, frame);
  } },
  { id: "bayon", name: "Bayon", emoji: "🗿", category: "cambodge", needsFace: false, render: ({ ctx, width, height, frame }) => {
    drawBayonEffect(ctx, width, height, frame);
  } },
  { id: "lotus", name: "Lotus halo", emoji: "🪷", category: "cambodge", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawLotusHalo(ctx, frame);
  } },
  { id: "krama", name: "Krama", emoji: "🧣", category: "cambodge", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawKrama(ctx, frame);
  } },
  { id: "buddha", name: "Buddha halo", emoji: "🧘", category: "cambodge", needsFace: true, render: ({ ctx, frame, time }) => {
    if (!frame) return;
    drawBuddhaHalo(ctx, frame, time);
  } },
  { id: "garuda", name: "Garuda", emoji: "🦅", category: "cambodge", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawGarudaWings(ctx, frame);
  } },
  { id: "naga", name: "Naga", emoji: "🐍", category: "cambodge", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawNagaCrown(ctx, frame);
  } },
  { id: "chaul-chnam", name: "Chaul Chnam", emoji: "🎊", category: "cambodge", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawKhmerNewYearPowder(ctx, frame);
  } },
  { id: "drapeau-khmer", name: "Drapeau khmer", emoji: "🇰🇭", category: "cambodge", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawCambodianFlagPaint(ctx, frame);
  } },

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
    drawPandaNose(ctx, frame);
  } },
  { id: "bear", name: "Ours", emoji: "🐻", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawBearEars(ctx, frame);
    drawAnimalSnout(ctx, frame, "#6b3e1f", "#3a2410");
  } },
  { id: "fox", name: "Renard", emoji: "🦊", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawFoxMask(ctx, frame);
    drawFoxEars(ctx, frame);
    drawAnimalSnout(ctx, frame, "#e67e22", "#0a0a0a");
  } },
  { id: "lion", name: "Lion", emoji: "🦁", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawLionMane(ctx, frame);
    // Smaller drawn nose (don't cover the user's face — just a hint)
    ctx.save();
    ctx.translate(frame.noseTip.x, frame.noseTip.y);
    ctx.rotate(frame.angle);
    ctx.fillStyle = "#3a2410";
    ctx.beginPath();
    ctx.ellipse(0, 0, frame.faceWidth * 0.05, frame.faceWidth * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } },
  { id: "tiger", name: "Tigre", emoji: "🐯", category: "animaux", needsFace: true, render: ({ ctx, frame }) => {
    if (!frame) return;
    drawTigerStripes(ctx, frame);
    drawCatEars(ctx, frame, "#d97706");
    drawAnimalSnout(ctx, frame, "#e67e22", "#5a2a0a");
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
    drawAnimalSnout(ctx, frame, "#c79870", "#3a1f10");
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
    drawAnimalSnout(ctx, frame, "#7a7a7a", "#1a1a1a");
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
