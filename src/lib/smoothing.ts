// Exponential moving average smoother for landmark points. Cheap, runs in O(n)
// per frame, and visibly reduces the micro-jitter you get from MediaPipe under
// average lighting.

export type Pt = { x: number; y: number; z?: number };

export class LandmarkSmoother {
  private prev: Pt[] | null = null;
  /** Higher alpha = more responsive but jitterier. 0.55 is a good default. */
  alpha: number;

  constructor(alpha = 0.55) {
    this.alpha = alpha;
  }

  reset() {
    this.prev = null;
  }

  smooth(current: Pt[]): Pt[] {
    if (!this.prev || this.prev.length !== current.length) {
      this.prev = current.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }));
      return this.prev;
    }
    const a = this.alpha;
    const out: Pt[] = new Array(current.length);
    for (let i = 0; i < current.length; i++) {
      const c = current[i];
      const p = this.prev[i];
      out[i] = {
        x: a * c.x + (1 - a) * p.x,
        y: a * c.y + (1 - a) * p.y,
        z: a * (c.z ?? 0) + (1 - a) * (p.z ?? 0),
      };
    }
    this.prev = out;
    return out;
  }
}
