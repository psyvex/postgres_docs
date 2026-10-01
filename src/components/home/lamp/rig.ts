/**
 * Geometry and physics behind the home page's wall lamps: the shade's pose, the beam's reach, and a
 * verlet chain for the pull cord. Pure functions over plain objects, so the component only reads a
 * pose and writes styles, and this file is unit-tested without a browser.
 *
 * Coordinates are the lamp host's own pixels, y down. Angle 0 points the shade straight down; a
 * positive angle tips it to the right.
 */

export type Point = { x: number; y: number; px: number; py: number };

export type Pose = {
  /** Where the cord meets the top of the shade. */
  sx: number;
  sy: number;
  /** The shade's mouth, where the light leaves it. */
  mx: number;
  my: number;
  /** The rim point the pull cord hangs from. */
  ax: number;
  ay: number;
};

/**
 * Pose of a shade `shadeW` × `shadeH` px on an arm of length `len` from the pivot (`px`, `py`). The shade is drawn
 * rotated by -th (CSS), so its local "down" (0, 1) points along (sin th, cos th) and its local x axis
 * along (cos th, -sin th); the rope's rim offset goes through that same basis.
 */
export function pose(px: number, len: number, th: number, shadeW: number, shadeH: number, py = 0): Pose {
  const s = Math.sin(th);
  const c = Math.cos(th);
  const sx = px + len * s;
  const sy = py + len * c;
  const ox = shadeW * 0.36;
  const oy = shadeH * 0.9;
  return {
    sx,
    sy,
    mx: sx + shadeH * s,
    my: sy + shadeH * c,
    ax: sx + ox * c + oy * s,
    ay: sy - ox * s + oy * c,
  };
}

/** A cord of `n` points hanging straight down from (x, y), `seg` px apart. */
export function hangRope(n: number, seg: number, x: number, y: number): Point[] {
  return Array.from({ length: n }, (_, i) => ({ x, y: y + i * seg, px: x, py: y + i * seg }));
}

/**
 * Verlet step for the cord: point 0 is pinned to the rim (ax, ay); the last point is pinned too while
 * the visitor holds the knob. Mutates `pts` in place — it runs every frame and allocating there is the
 * one cost this loop can avoid.
 */
export function stepRope(pts: Point[], seg: number, ax: number, ay: number, dt: number, held: boolean, gravity = 2600): void {
  const n = pts.length;
  for (let i = 1; i < n; i++) {
    if (held && i === n - 1) continue;
    const q = pts[i];
    const vx = (q.x - q.px) * 0.93;
    const vy = (q.y - q.py) * 0.93;
    q.px = q.x;
    q.py = q.y;
    q.x += vx;
    q.y += vy + gravity * dt * dt;
  }
  for (let it = 0; it < 8; it++) {
    pts[0].x = ax;
    pts[0].y = ay;
    for (let j = 0; j < n - 1; j++) {
      const a = pts[j];
      const b = pts[j + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const diff = (d - seg) / d;
      const pinB = held && j + 1 === n - 1;
      if (j === 0) {
        if (!pinB) {
          b.x -= dx * diff;
          b.y -= dy * diff;
        }
      } else if (pinB) {
        a.x += dx * diff;
        a.y += dy * diff;
      } else {
        a.x += dx * diff * 0.5;
        a.y += dy * diff * 0.5;
        b.x -= dx * diff * 0.5;
        b.y -= dy * diff * 0.5;
      }
    }
  }
}

/**
 * How lit a point (x, y) is by a beam leaving (mx, my) along angle th with half-angle `alpha`:
 * 1 on the axis, fading to 0 just past the cone's edge, and 0 behind the shade.
 */
export function litness(x: number, y: number, mx: number, my: number, th: number, alpha: number): number {
  const dx = Math.sin(th);
  const dy = Math.cos(th);
  const vx = x - mx;
  const vy = y - my;
  const along = vx * dx + vy * dy;
  if (along <= 0) return 0;
  const perp = Math.abs(vx * dy - vy * dx);
  return Math.max(0, Math.min(1, 1.35 - perp / (along * Math.tan(alpha) + 30)));
}
