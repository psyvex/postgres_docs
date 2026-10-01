import { describe, expect, it } from 'vitest';
import { hangRope, litness, pose, stepRope } from './rig';

describe('pose', () => {
  it('hangs straight down at angle 0', () => {
    const p = pose(100, 50, 0, 80, 40);
    expect(p.sx).toBe(100);
    expect(p.sy).toBe(50);
    expect(p.mx).toBe(100);
    expect(p.my).toBe(90);
    expect(p.ax).toBeCloseTo(100 + 80 * 0.36);
  });

  it('moves the shade right for a positive angle', () => {
    expect(pose(100, 50, 0.3, 80, 40).sx).toBeGreaterThan(100);
  });
});

describe('stepRope', () => {
  it('keeps a hanging cord at its length and pinned to the rim', () => {
    const pts = hangRope(10, 9, 50, 20);
    for (let i = 0; i < 120; i++) stepRope(pts, 9, 50, 20, 1 / 60, false);
    expect(pts[0]).toMatchObject({ x: 50, y: 20 });
    const tail = pts[pts.length - 1];
    // Eight constraint passes against gravity leave a few percent of stretch: fine for a cord, not a ruler.
    const reach = Math.hypot(tail.x - 50, tail.y - 20);
    expect(reach).toBeGreaterThan(78);
    expect(reach).toBeLessThan(86);
  });

  it('leaves the knob where the hand holds it', () => {
    const pts = hangRope(10, 9, 50, 20);
    const tail = pts[pts.length - 1];
    tail.x = tail.px = 70;
    tail.y = tail.py = 90;
    stepRope(pts, 9, 50, 20, 1 / 60, true);
    expect(tail).toMatchObject({ x: 70, y: 90 });
  });
});

describe('litness', () => {
  it('is full on the axis, zero far outside and behind the shade', () => {
    expect(litness(100, 300, 100, 50, 0, 0.15)).toBe(1);
    expect(litness(400, 300, 100, 50, 0, 0.15)).toBe(0);
    expect(litness(100, 10, 100, 50, 0, 0.15)).toBe(0);
  });

  it('follows the swing', () => {
    expect(litness(200, 300, 100, 50, 0.38, 0.15)).toBeGreaterThan(litness(200, 300, 100, 50, 0, 0.15));
  });
});
