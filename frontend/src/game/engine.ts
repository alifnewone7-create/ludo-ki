// Hexagonal 6-player Ludo engine (also supports 5 players — one empty seat).
// Pure logic, no rendering. progress: -1 = base/yard, 0..47 = ring, 48..52 = home column, 53 = finished.

export const SEATS = 6;
export const CELLS_PER_SIDE = 8;
export const RING = SEATS * CELLS_PER_SIDE; // 48
export const RING_TRAVEL = RING - 1; // 47 -> last ring cell (home entry)
export const HOME_LEN = 5; // progress 48..52
export const FINISH = RING_TRAVEL + HOME_LEN + 1; // 53
export const TOKENS = 4;

// Seat colors follow the reference board layout.
export const SEAT_COLORS = ["blue", "yellow", "purple", "red", "green", "orange"];

export const startCell = (seat: number) => seat * CELLS_PER_SIDE;

// Safe ring cells: each seat's start + each side's middle star.
const SAFE = new Set<number>();
for (let s = 0; s < SEATS; s++) {
  SAFE.add(startCell(s));
  SAFE.add((startCell(s) + 4) % RING);
}
export const isSafeRing = (ringIndex: number) => SAFE.has(ringIndex);

// Ring index a token occupies at a given board progress.
export const ringIndexOf = (seat: number, progress: number) =>
  (startCell(seat) + progress) % RING;

export interface Token {
  id: number;
  progress: number;
}

export interface PlayerState {
  seat: number;
  color: string;
  name: string;
  isBot: boolean;
  tokens: Token[];
  rank: number | null; // finishing position once all tokens home
}

export type Phase = "roll" | "move" | "over";

export interface Snapshot {
  code: string;
  players: PlayerState[];
  turn: number; // index into players
  dice: number | null;
  phase: Phase;
  movable: number[];
  finishedOrder: string[]; // colors in order they finished
  message: string;
  lastRoll: { color: string; value: number } | null;
}

export class LudoGame {
  players: PlayerState[];
  turn = 0;
  dice: number | null = null;
  phase: Phase = "roll";
  movable: number[] = [];
  sixStreak = 0; // consecutive sixes this turn (3 -> forfeit)
  finishedOrder: string[] = [];
  message = "";
  lastRoll: { color: string; value: number } | null = null;
  code: string;

  constructor(code: string, seats: { seat: number; name: string; isBot: boolean }[]) {
    this.code = code;
    this.players = seats
      .slice()
      .sort((a, b) => a.seat - b.seat)
      .map((s) => ({
        seat: s.seat,
        color: SEAT_COLORS[s.seat],
        name: s.name,
        isBot: s.isBot,
        rank: null,
        tokens: Array.from({ length: TOKENS }, (_, i) => ({ id: i, progress: -1 })),
      }));
    this.message = `${this.players[0].name}'s turn`;
  }

  get current() {
    return this.players[this.turn];
  }

  activeCount() {
    return this.players.filter((p) => p.rank === null).length;
  }

  snapshot(): Snapshot {
    return {
      code: this.code,
      players: this.players.map((p) => ({ ...p, tokens: p.tokens.map((t) => ({ ...t })) })),
      turn: this.turn,
      dice: this.dice,
      phase: this.phase,
      movable: [...this.movable],
      finishedOrder: [...this.finishedOrder],
      message: this.message,
      lastRoll: this.lastRoll,
    };
  }

  private computeMovable(d: number): number[] {
    const p = this.current;
    const out: number[] = [];
    for (const t of p.tokens) {
      if (t.progress === FINISH) continue;
      if (t.progress === -1) {
        if (d === 6) out.push(t.id);
      } else if (t.progress + d <= FINISH) {
        out.push(t.id);
      }
    }
    return out;
  }

  private advanceTurn() {
    this.dice = null;
    this.sixStreak = 0;
    this.movable = [];
    this.phase = "roll";
    if (this.activeCount() <= 1) {
      // last remaining player finishes last
      const last = this.players.find((p) => p.rank === null);
      if (last) {
        last.rank = this.finishedOrder.length + 1;
        this.finishedOrder.push(last.color);
      }
      this.phase = "over";
      this.message = "Game over";
      return;
    }
    do {
      this.turn = (this.turn + 1) % this.players.length;
    } while (this.current.rank !== null);
    this.message = `${this.current.name}'s turn`;
  }

  // value must already be the final (possibly manipulated) die value 1..6
  applyRoll(value: number): { forfeited: boolean; needsMove: boolean } {
    this.dice = value;
    this.lastRoll = { color: this.current.color, value };
    if (value === 6) this.sixStreak++;
    else this.sixStreak = 0;

    if (this.sixStreak >= 3) {
      this.message = `${this.current.name} rolled three 6s — turn skipped`;
      this.advanceTurn();
      return { forfeited: true, needsMove: false };
    }

    this.movable = this.computeMovable(value);
    if (this.movable.length === 0) {
      // no move possible
      if (value === 6) {
        // rolled 6 but nothing to move -> still passes
        this.advanceTurn();
      } else {
        this.advanceTurn();
      }
      return { forfeited: false, needsMove: false };
    }
    this.phase = "move";
    this.message = `${this.current.name}: pick a token`;
    return { forfeited: false, needsMove: true };
  }

  // Returns extra info for reporting.
  applyMove(tokenId: number): { captured: boolean; finished: boolean; extra: boolean; gameOver: boolean } {
    const p = this.current;
    const t = p.tokens.find((x) => x.id === tokenId)!;
    const d = this.dice!;
    let captured = false;
    let finished = false;

    if (t.progress === -1) {
      t.progress = 0;
    } else {
      t.progress += d;
    }

    // capture check on the ring
    if (t.progress >= 0 && t.progress <= RING_TRAVEL) {
      const ri = ringIndexOf(p.seat, t.progress);
      if (!isSafeRing(ri)) {
        for (const other of this.players) {
          if (other.color === p.color) continue;
          for (const ot of other.tokens) {
            if (ot.progress >= 0 && ot.progress <= RING_TRAVEL) {
              if (ringIndexOf(other.seat, ot.progress) === ri) {
                ot.progress = -1;
                captured = true;
              }
            }
          }
        }
      }
    }

    if (t.progress === FINISH) finished = true;

    // did this player finish all tokens?
    if (p.tokens.every((x) => x.progress === FINISH) && p.rank === null) {
      p.rank = this.finishedOrder.length + 1;
      this.finishedOrder.push(p.color);
    }

    const extra = (d === 6 || captured || finished) && p.rank === null;

    if (p.rank !== null) {
      // player finished this move -> move on
      this.advanceTurn();
      const over = this.phase === "over";
      return { captured, finished, extra: false, gameOver: over };
    }

    if (extra) {
      this.dice = null;
      this.movable = [];
      this.phase = "roll";
      this.message = `${p.name} rolls again`;
      return { captured, finished, extra: true, gameOver: false };
    }

    this.advanceTurn();
    return { captured, finished, extra: false, gameOver: this.phase === "over" };
  }

  // Simple bot: prefer capture, then finishing, then releasing from base, then furthest token.
  botPick(): number {
    const p = this.current;
    const d = this.dice!;
    let best = this.movable[0];
    let bestScore = -1;
    for (const id of this.movable) {
      const t = p.tokens.find((x) => x.id === id)!;
      let score = 0;
      if (t.progress === -1) score = 20;
      else {
        const np = t.progress + d;
        if (np === FINISH) score = 100;
        else if (np <= RING_TRAVEL) {
          const ri = ringIndexOf(p.seat, np);
          if (!isSafeRing(ri)) {
            for (const o of this.players) {
              if (o.color === p.color) continue;
              for (const ot of o.tokens) {
                if (ot.progress >= 0 && ot.progress <= RING_TRAVEL && ringIndexOf(o.seat, ot.progress) === ri) {
                  score = Math.max(score, 80);
                }
              }
            }
          }
          score = Math.max(score, 10 + t.progress / 6);
        } else {
          score = Math.max(score, 30 + t.progress / 6);
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return best;
  }
}

// ---- Subtle dice manipulation (mirrors the Android game) ----
const betterOfTwo = () =>
  Math.max(1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6));
const worseOfTwo = () =>
  Math.min(1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6));

export interface Control {
  ranks?: Record<string, number>;
  force?: Record<string, number>;
}

// Keeps things natural: max 2 consecutive 6s per color, only mild luck bias.
export function manipulate(
  color: string,
  natural: number,
  control: Control | null,
  sixStreak: Record<string, number>
): { value: number; usedForce: boolean } {
  let usedForce = false;
  let result = natural;

  const forced = control?.force?.[color];
  if (forced && forced >= 1 && forced <= 6) {
    result = forced;
    usedForce = true;
  } else if (control?.ranks && control.ranks[color]) {
    const rank = control.ranks[color];
    const worst = Math.max(...Object.values(control.ranks));
    if (rank <= 2) {
      const chance = rank === 1 ? 0.32 : 0.2;
      if (Math.random() < chance) result = betterOfTwo();
    } else if (rank >= worst && worst >= 3) {
      if (Math.random() < 0.22) result = worseOfTwo();
    }
  }

  // cap consecutive sixes
  const streak = sixStreak[color] || 0;
  if (result === 6) {
    if (streak >= 2) {
      result = 2 + Math.floor(Math.random() * 4); // 2..5
      sixStreak[color] = 0;
    } else {
      sixStreak[color] = streak + 1;
    }
  } else {
    sixStreak[color] = 0;
  }

  return { value: result, usedForce };
}
