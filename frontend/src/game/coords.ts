// Screen coordinates for the hexagonal board.
import {
  CELLS_PER_SIDE,
  HOME_LEN,
  RING,
  SEATS,
  startCell,
} from "./engine";

export interface Pt {
  x: number;
  y: number;
}

// Regular hexagon corners (pointy sides), corner c at 90 + 60*c degrees.
export function corners(cx: number, cy: number, R: number): Pt[] {
  const pts: Pt[] = [];
  for (let c = 0; c < SEATS; c++) {
    const a = ((90 + 60 * c) * Math.PI) / 180;
    pts.push({ x: cx + R * Math.cos(a), y: cy - R * Math.sin(a) });
  }
  return pts;
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

// Position of a ring cell (0..RING-1).
export function ringCellPos(ringIndex: number, cx: number, cy: number, R: number): Pt {
  const cs = corners(cx, cy, R);
  const side = Math.floor(ringIndex / CELLS_PER_SIDE);
  const i = ringIndex % CELLS_PER_SIDE;
  const A = cs[side];
  const B = cs[(side + 1) % SEATS];
  const t = (i + 0.5) / CELLS_PER_SIDE;
  const edge = lerp(A, B, t);
  // pull slightly inward from the very edge
  return lerp({ x: cx, y: cy }, edge, 0.94);
}

// Home column cells for a seat (j = 0..HOME_LEN-1), from ring home-entry toward center.
export function homeCellPos(seat: number, j: number, cx: number, cy: number, R: number): Pt {
  const entryRing = (startCell(seat) + RING - 1) % RING; // last ring cell before start
  const entry = ringCellPos(entryRing, cx, cy, R);
  const center = { x: cx, y: cy };
  const t = (j + 1) / (HOME_LEN + 1.6);
  return lerp(entry, center, t);
}

export const centerPos = (cx: number, cy: number): Pt => ({ x: cx, y: cy });

// Base yard anchor for a seat: outside the ring, beyond the middle of its side.
export function baseAnchor(seat: number, cx: number, cy: number, R: number): Pt {
  const cs = corners(cx, cy, R);
  const A = cs[seat];
  const B = cs[(seat + 1) % SEATS];
  const mid = lerp(A, B, 0.5);
  return lerp({ x: cx, y: cy }, mid, 1.24);
}

// One of 4 token slots inside a base yard.
export function baseSlotPos(seat: number, slot: number, cx: number, cy: number, R: number, gap: number): Pt {
  const anchor = baseAnchor(seat, cx, cy, R);
  const dx = slot % 2 === 0 ? -gap : gap;
  const dy = slot < 2 ? -gap : gap;
  return { x: anchor.x + dx, y: anchor.y + dy };
}

// Sector background polygon (triangle center-> two corners) for coloring each side.
export function sectorPolygon(seat: number, cx: number, cy: number, R: number): string {
  const cs = corners(cx, cy, R);
  const A = cs[seat];
  const B = cs[(seat + 1) % SEATS];
  return `${cx},${cy} ${A.x},${A.y} ${B.x},${B.y}`;
}

export function hexPath(cx: number, cy: number, R: number): string {
  const cs = corners(cx, cy, R);
  return cs.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
}
