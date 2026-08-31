import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Path, Polygon, Text as SvgText } from "react-native-svg";
import { onValue, ref, remove, set, update } from "firebase/database";
import { db } from "@/src/lib/firebase";
import {
  Control,
  FINISH,
  HOME_LEN,
  LudoGame,
  RING,
  RING_TRAVEL,
  SEAT_COLORS,
  Snapshot,
  isSafeRing,
  manipulate,
  ringIndexOf,
  startCell,
} from "@/src/game/engine";
import {
  baseSlotPos,
  centerPos,
  hexPath,
  homeCellPos,
  ringCellPos,
  sectorPolygon,
} from "@/src/game/coords";
import { C, F, LUDO_COLORS, R, SP } from "@/src/theme";

function buzz(style: "light" | "medium" | "heavy" = "light") {
  if (Platform.OS === "web") return;
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  };
  Haptics.impactAsync(map[style]);
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ seats: string }>();

  const gameRef = useRef<LudoGame | null>(null);
  const sixStreakRef = useRef<Record<string, number>>({});
  const controlRef = useRef<Control | null>(null);
  const recentRef = useRef<{ color: string; value: number; ts: number }[]>([]);
  const reportedRanks = useRef<Set<number>>(new Set());
  const finishedWrite = useRef(false);
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [rolling, setRolling] = useState(false);

  // ---- init ----
  useEffect(() => {
    if (gameRef.current) return; // guard against double-invoke
    const seats = JSON.parse(params.seats || "[]");
    const code = String(100000 + Math.floor(Math.random() * 900000));
    const g = new LudoGame(code, seats);
    gameRef.current = g;
    setSnap(g.snapshot());

    // Firebase: create match + subscribe control
    const players: Record<string, any> = {};
    g.players.forEach((p) => {
      players[p.color] = { name: p.name, isBot: p.isBot, order: p.seat };
    });
    set(ref(db, `matches/${code}`), {
      code,
      status: "live",
      createdAt: Date.now(),
      nop: g.players.length,
      gametype: 5,
      players,
      state: { currentTurn: g.current.color },
    }).catch(() => {});

    const unsub = onValue(ref(db, `matches/${code}/control`), (s) => {
      controlRef.current = (s.val() as Control) || null;
    });

    return () => {
      unsub();
      if (botTimer.current) clearTimeout(botTimer.current);
      if (!finishedWrite.current) {
        update(ref(db, `matches/${code}`), {
          status: "abandoned",
          finishedAt: Date.now(),
        }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressJson = (g: LudoGame) => {
    const o: Record<string, number> = {};
    g.players.forEach((p) => {
      o[p.color] = p.tokens.reduce((a, t) => a + Math.max(0, t.progress), 0);
    });
    return o;
  };

  const reportState = (g: LudoGame, roll?: { color: string; value: number }) => {
    const patch: any = {
      currentTurn: g.current.color,
      progress: progressJson(g),
    };
    if (roll) {
      const entry = { ...roll, ts: Date.now() };
      recentRef.current = [...recentRef.current, entry].slice(-14);
      patch.lastRoll = entry;
      patch.recentRolls = recentRef.current;
    }
    update(ref(db, `matches/${g.code}/state`), patch).catch(() => {});
  };

  const reportWinners = (g: LudoGame) => {
    g.players.forEach((p) => {
      if (p.rank !== null && !reportedRanks.current.has(p.rank)) {
        reportedRanks.current.add(p.rank);
        update(ref(db, `matches/${g.code}/winners/${p.rank}`), {
          color: p.color,
          name: p.name,
        }).catch(() => {});
      }
    });
  };

  const doRoll = () => {
    const g = gameRef.current;
    if (!g || g.phase !== "roll" || rolling) return;
    setRolling(true);
    const color = g.current.color;
    const natural = 1 + Math.floor(Math.random() * 6);
    const { value, usedForce } = manipulate(
      color,
      natural,
      controlRef.current,
      sixStreakRef.current
    );
    if (usedForce) {
      // consume the forced value so it fires only once
      remove(ref(db, `matches/${g.code}/control/force/${color}`)).catch(() => {});
    }
    buzz("light");
    setTimeout(() => {
      g.applyRoll(value);
      reportState(g, { color, value });
      setSnap(g.snapshot());
      setRolling(false);
    }, 260);
  };

  const doMove = (tokenId: number) => {
    const g = gameRef.current;
    if (!g || g.phase !== "move") return;
    if (!g.movable.includes(tokenId)) return;
    const res = g.applyMove(tokenId);
    if (res.captured) buzz("heavy");
    else buzz("medium");
    reportWinners(g);
    reportState(g);
    if (g.phase === "over" && !finishedWrite.current) {
      finishedWrite.current = true;
      update(ref(db, `matches/${g.code}`), {
        status: "finished",
        finishedAt: Date.now(),
      }).catch(() => {});
    }
    setSnap(g.snapshot());
  };

  // ---- bot driver ----
  useEffect(() => {
    const g = gameRef.current;
    if (!g || !snap || snap.phase === "over") return;
    if (!g.current.isBot) return;
    if (botTimer.current) clearTimeout(botTimer.current);
    botTimer.current = setTimeout(() => {
      if (g.phase === "roll") doRoll();
      else if (g.phase === "move") doMove(g.botPick());
    }, 750);
    return () => {
      if (botTimer.current) clearTimeout(botTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.turn, snap?.phase, snap?.dice, snap?.movable.length]);

  // ---- geometry ----
  const board = useMemo(() => {
    const size = Math.min(width - SP.lg * 2, 460);
    const cx = size / 2;
    const cy = size / 2;
    const Rr = size * 0.44;
    return { size, cx, cy, Rr };
  }, [width]);

  if (!snap) {
    return <View style={styles.root} />;
  }

  const { size, cx, cy, Rr } = board;
  const cellR = size * 0.028;
  const tokenR = size * 0.03;
  const gameOver = snap.phase === "over";

  // token screen positions with stacking offset
  type Tk = { color: string; seat: number; id: number; x: number; y: number; movable: boolean };
  const groups: Record<string, Tk[]> = {};
  const tokens: Tk[] = [];
  snap.players.forEach((p) => {
    p.tokens.forEach((t) => {
      let pos;
      let key;
      if (t.progress === -1) {
        pos = baseSlotPos(p.seat, t.id, cx, cy, Rr, cellR * 1.5);
        key = `b${p.seat}${t.id}`;
      } else if (t.progress <= RING_TRAVEL) {
        const ri = ringIndexOf(p.seat, t.progress);
        pos = ringCellPos(ri, cx, cy, Rr);
        key = `r${ri}`;
      } else if (t.progress < FINISH) {
        pos = homeCellPos(p.seat, t.progress - (RING_TRAVEL + 1), cx, cy, Rr);
        key = `h${p.seat}_${t.progress}`;
      } else {
        pos = centerPos(cx, cy);
        key = `f`;
      }
      const isCurrent = snap.players[snap.turn].color === p.color;
      const movable = isCurrent && snap.phase === "move" && snap.movable.includes(t.id);
      const tk: Tk = { color: p.color, seat: p.seat, id: t.id, x: pos.x, y: pos.y, movable };
      tokens.push(tk);
      (groups[key] ||= []).push(tk);
    });
  });
  // spread stacked tokens
  Object.values(groups).forEach((arr) => {
    if (arr.length > 1) {
      arr.forEach((tk, i) => {
        const ang = (i / arr.length) * Math.PI * 2;
        tk.x += Math.cos(ang) * tokenR * 0.9;
        tk.y += Math.sin(ang) * tokenR * 0.9;
      });
    }
  });

  const current = snap.players[snap.turn];
  const humanTurn = !current.isBot && !gameOver;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="game-screen">
      {/* header */}
      <View style={styles.header}>
        <Pressable testID="game-exit" onPress={() => router.replace("/")} hitSlop={12}>
          <Ionicons name="close" size={26} color={C.onSurface} />
        </Pressable>
        <Text style={styles.code}>#{snap.code}</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* turn banner */}
      <View style={styles.turnBanner} testID="turn-banner">
        <View style={[styles.turnDot, { backgroundColor: LUDO_COLORS[current.color] }]} />
        <Text style={styles.turnText}>{gameOver ? "Game Over" : snap.message}</Text>
      </View>

      {/* board */}
      <View style={{ alignItems: "center", marginTop: SP.md }}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            {/* sector fills */}
            {snap.players.map((p) => (
              <Polygon
                key={`sec${p.seat}`}
                points={sectorPolygon(p.seat, cx, cy, Rr)}
                fill={LUDO_COLORS[p.color]}
                opacity={0.13}
              />
            ))}
            <Path d={hexPath(cx, cy, Rr)} fill="none" stroke={C.borderStrong} strokeWidth={2} />

            {/* ring cells */}
            {Array.from({ length: RING }, (_, ri) => {
              const pos = ringCellPos(ri, cx, cy, Rr);
              const owner = Math.floor(ri / (RING / 6));
              const safe = isSafeRing(ri);
              const isStart = ri === startCell(owner);
              return (
                <Circle
                  key={`ring${ri}`}
                  cx={pos.x}
                  cy={pos.y}
                  r={cellR}
                  fill={isStart ? LUDO_COLORS[SEAT_COLORS[owner]] : safe ? C.surfaceTertiary : C.surfaceSecondary}
                  stroke={C.border}
                  strokeWidth={1}
                />
              );
            })}

            {/* home columns */}
            {snap.players.map((p) =>
              Array.from({ length: HOME_LEN }, (_, j) => {
                const pos = homeCellPos(p.seat, j, cx, cy, Rr);
                return (
                  <Circle
                    key={`home${p.seat}_${j}`}
                    cx={pos.x}
                    cy={pos.y}
                    r={cellR * 0.85}
                    fill={LUDO_COLORS[p.color]}
                    opacity={0.55}
                  />
                );
              })
            )}

            {/* center */}
            <Circle cx={cx} cy={cy} r={cellR * 1.7} fill={C.surfaceTertiary} stroke={C.borderStrong} strokeWidth={2} />
            <SvgText x={cx} y={cy + 4} fontSize={cellR * 1.4} fill={C.onSurfaceTertiary} textAnchor="middle" fontFamily={F.display}>
              ★
            </SvgText>

            {/* base yards */}
            {snap.players.map((p) => {
              const b0 = baseSlotPos(p.seat, 0, cx, cy, Rr, cellR * 1.5);
              const b3 = baseSlotPos(p.seat, 3, cx, cy, Rr, cellR * 1.5);
              const minX = Math.min(b0.x, b3.x) - cellR * 1.6;
              const minY = Math.min(b0.y, b3.y) - cellR * 1.6;
              const w = Math.abs(b3.x - b0.x) + cellR * 3.2;
              const h = Math.abs(b3.y - b0.y) + cellR * 3.2;
              return (
                <Polygon
                  key={`yard${p.seat}`}
                  points={`${minX},${minY} ${minX + w},${minY} ${minX + w},${minY + h} ${minX},${minY + h}`}
                  fill={LUDO_COLORS[p.color]}
                  opacity={0.22}
                  stroke={LUDO_COLORS[p.color]}
                  strokeWidth={1.5}
                />
              );
            })}

            {/* tokens (drawn in svg for crispness) */}
            {tokens.map((tk) => (
              <Circle
                key={`tok${tk.seat}_${tk.id}`}
                cx={tk.x}
                cy={tk.y}
                r={tokenR}
                fill={LUDO_COLORS[tk.color]}
                stroke={tk.movable ? "#FFFFFF" : "rgba(0,0,0,0.35)"}
                strokeWidth={tk.movable ? 2.5 : 1.5}
              />
            ))}
          </Svg>

          {/* tap targets for movable tokens */}
          {tokens
            .filter((tk) => tk.movable)
            .map((tk) => (
              <Pressable
                key={`tap${tk.seat}_${tk.id}`}
                testID={`token-${tk.color}-${tk.id}`}
                onPress={() => doMove(tk.id)}
                style={{
                  position: "absolute",
                  left: tk.x - tokenR * 1.8,
                  top: tk.y - tokenR * 1.8,
                  width: tokenR * 3.6,
                  height: tokenR * 3.6,
                  borderRadius: tokenR * 1.8,
                }}
              />
            ))}
        </View>
      </View>

      {/* players strip */}
      <View style={styles.playersStrip}>
        {snap.players.map((p) => (
          <View
            key={p.color}
            style={[
              styles.playerChip,
              snap.players[snap.turn].color === p.color && !gameOver && {
                borderColor: LUDO_COLORS[p.color],
              },
            ]}
          >
            <View style={[styles.chipDot, { backgroundColor: LUDO_COLORS[p.color] }]} />
            <Text style={styles.chipName} numberOfLines={1}>
              {p.name}
            </Text>
            {p.rank !== null && <Text style={styles.chipRank}>#{p.rank}</Text>}
          </View>
        ))}
      </View>

      {/* dice */}
      <View style={[styles.diceArea, { paddingBottom: insets.bottom + SP.md }]}>
        <Pressable
          testID="roll-dice-button"
          disabled={!humanTurn || snap.phase !== "roll" || rolling}
          onPress={doRoll}
          style={[
            styles.dice,
            { borderColor: LUDO_COLORS[current.color] },
            (!humanTurn || snap.phase !== "roll") && { opacity: 0.55 },
          ]}
        >
          <Text style={styles.diceValue}>{snap.dice ?? "🎲"}</Text>
        </Pressable>
        <Text style={styles.diceHint}>
          {gameOver
            ? "খেলা শেষ"
            : current.isBot
            ? `${current.name} (bot) খেলছে…`
            : snap.phase === "roll"
            ? "ডাইস চাপুন"
            : "একটি গুটি বেছে চাল দিন"}
        </Text>
      </View>

      {/* game over overlay */}
      {gameOver && (
        <View style={styles.overlay} testID="game-over-overlay">
          <View style={styles.overlayCard}>
            <Ionicons name="trophy" size={40} color={C.warning} />
            <Text style={styles.overlayTitle}>ফলাফল</Text>
            {snap.finishedOrder.map((color, i) => {
              const pl = snap.players.find((p) => p.color === color)!;
              return (
                <View key={color} style={styles.resultRow}>
                  <Text style={styles.resultRank}>#{i + 1}</Text>
                  <View style={[styles.chipDot, { backgroundColor: LUDO_COLORS[color] }]} />
                  <Text style={styles.resultName}>{pl.name}</Text>
                </View>
              );
            })}
            <Pressable testID="overlay-home" onPress={() => router.replace("/")} style={styles.overlayBtn}>
              <Text style={styles.overlayBtnText}>হোম-এ ফিরুন</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
  },
  code: { fontFamily: F.display, fontSize: 22, color: C.onSurface, letterSpacing: 2 },
  turnBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    paddingVertical: SP.sm,
  },
  turnDot: { width: 12, height: 12, borderRadius: 6 },
  turnText: { fontFamily: F.displaySemi, fontSize: 17, color: C.onSurface },
  playersStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SP.sm,
    paddingHorizontal: SP.md,
    marginTop: SP.md,
  },
  playerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    paddingVertical: 5,
  },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  chipName: { fontFamily: F.text, fontSize: 12, color: C.onSurfaceSecondary, maxWidth: 74 },
  chipRank: { fontFamily: F.displaySemi, fontSize: 12, color: C.warning },
  diceArea: { alignItems: "center", gap: SP.sm, marginTop: "auto", paddingTop: SP.md },
  dice: {
    width: 64,
    height: 64,
    borderRadius: R.md,
    borderWidth: 3,
    backgroundColor: C.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  diceValue: { fontFamily: F.display, fontSize: 34, color: C.onSurface },
  diceHint: { fontFamily: F.text, fontSize: 13, color: C.onSurfaceTertiary },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: SP.xl,
  },
  overlayCard: {
    width: "100%",
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: R.lg,
    padding: SP.xl,
    alignItems: "center",
    gap: SP.md,
  },
  overlayTitle: { fontFamily: F.display, fontSize: 28, color: C.onSurface, letterSpacing: 1 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: SP.md, alignSelf: "stretch" },
  resultRank: { fontFamily: F.displaySemi, fontSize: 18, color: C.warning, width: 34 },
  resultName: { fontFamily: F.text, fontSize: 15, color: C.onSurface },
  overlayBtn: {
    marginTop: SP.md,
    backgroundColor: C.brandPrimary,
    borderRadius: R.md,
    paddingHorizontal: SP.xl,
    paddingVertical: SP.md,
  },
  overlayBtnText: { fontFamily: F.displaySemi, fontSize: 15, color: C.onBrandPrimary, letterSpacing: 1 },
});
