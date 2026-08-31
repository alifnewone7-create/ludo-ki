import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { onValue, ref, update, remove, set } from "firebase/database";
import { db, Match, GAME_TYPES } from "@/src/lib/firebase";
import { C, F, LUDO_COLORS, R, SP, timeAgo } from "@/src/theme";

const MAX_PROGRESS = 224; // 4 pieces x 56 steps

function haptic(style: "light" | "medium" | "heavy") {
  if (Platform.OS === "web") return;
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  };
  Haptics.impactAsync(map[style]);
}

export default function MatchControlScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null | undefined>(undefined);
  const [rank1, setRank1] = useState<string>("");
  const [rank2, setRank2] = useState<string>("");
  const [synced, setSynced] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const unsub = onValue(ref(db, `matches/${id}`), (snap) => {
      const val = snap.val();
      setMatch(val || null);
      if (val && !synced) {
        setRank1(val.control?.rank1 || "");
        setRank2(val.control?.rank2 || "");
        setSynced(true);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const applyManipulation = async () => {
    haptic("medium");
    await update(ref(db, `matches/${id}/control`), {
      rank1: rank1 || "",
      rank2: rank2 || "",
    });
    showToast("Manipulation applied — dice will now favor the targets");
  };

  const clearManipulation = async () => {
    haptic("heavy");
    setRank1("");
    setRank2("");
    await remove(ref(db, `matches/${id}/control`));
    showToast("Manipulation cleared — game is fully natural");
  };

  const forceDice = async (color: string, v: number) => {
    haptic("light");
    const current = match?.control?.force?.[color] || 0;
    await set(
      ref(db, `matches/${id}/control/force/${color}`),
      current === v ? 0 : v
    );
  };

  if (match === undefined) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={C.brandPrimary} />
      </View>
    );
  }
  if (match === null) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.dimText}>Match not found</Text>
        <Pressable testID="back-btn-notfound" onPress={() => router.back()} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const players = Object.entries(match.players || {}).sort(
    (a, b) => (a[1].order || 0) - (b[1].order || 0)
  );
  const rolls = (match.state?.recentRolls || []).slice().reverse();
  const progress = match.state?.progress || {};
  const currentTurn = match.state?.currentTurn || "";
  const winners = Object.entries(match.winners || {}).sort(
    ([a], [b]) => Number(a) - Number(b)
  );
  const isLive = match.status === "live";

  return (
    <View style={styles.root} testID="match-control-screen">
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <Pressable testID="match-back-button" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </Pressable>
        <Text style={styles.headerCode}>#{match.code}</Text>
        <View
          style={[
            styles.statusBadge,
            { borderColor: isLive ? C.success : C.onSurfaceTertiary },
          ]}
        >
          <View
            style={[
              styles.pulseDot,
              { backgroundColor: isLive ? C.success : C.onSurfaceTertiary },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isLive ? C.success : C.onSurfaceTertiary },
            ]}
          >
            {match.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SP.lg, paddingBottom: 140 + insets.bottom, gap: SP.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.metaLine}>
          {GAME_TYPES[match.gametype] || "CLASSIC"} · {match.nop} PLAYERS · started{" "}
          {timeAgo(match.createdAt)}
        </Text>

        {/* Winners */}
        {winners.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RESULTS</Text>
            <View style={{ gap: SP.sm }}>
              {winners.map(([pos, w]) => (
                <View key={pos} style={styles.winnerRow}>
                  <Text style={styles.winnerRank}>{pos === "1" ? "🥇 1ST" : pos === "2" ? "🥈 2ND" : `${pos}TH`}</Text>
                  <View style={[styles.dotLg, { backgroundColor: LUDO_COLORS[w.color] }]} />
                  <Text style={styles.winnerName}>{w.name || w.color}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Live rolls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT DICE ROLLS</Text>
          {rolls.length === 0 ? (
            <Text style={styles.dimText}>No rolls yet</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: SP.sm, paddingRight: SP.lg }}
              style={{ height: 56 }}
            >
              {rolls.map((r, i) => (
                <View
                  key={`${r.ts}-${i}`}
                  style={[
                    styles.rollChip,
                    { borderColor: LUDO_COLORS[r.color] || C.border },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: LUDO_COLORS[r.color] }]} />
                  <Text style={styles.rollValue}>{r.value}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Players */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PLAYERS · FORCE NEXT DICE</Text>
          <View style={{ gap: SP.md }}>
            {players.map(([color, p]) => {
              const prog = progress[color] || 0;
              const pct = Math.min(100, Math.round((prog / MAX_PROGRESS) * 100));
              const forced = match.control?.force?.[color] || 0;
              const isTurn = currentTurn === color;
              return (
                <View
                  key={color}
                  testID={`player-card-${color}`}
                  style={[
                    styles.playerCard,
                    isTurn && { borderColor: LUDO_COLORS[color] },
                  ]}
                >
                  <View style={styles.playerTop}>
                    <View style={styles.playerId}>
                      <View style={[styles.dotLg, { backgroundColor: LUDO_COLORS[color] }]} />
                      <Text style={styles.playerName}>
                        {p.name}
                        {p.isBot ? " (bot)" : ""}
                      </Text>
                    </View>
                    <View style={styles.playerTags}>
                      {isTurn && isLive && (
                        <View style={styles.turnBadge}>
                          <Text style={styles.turnText}>TURN</Text>
                        </View>
                      )}
                      <Text style={styles.pctText}>{pct}%</Text>
                    </View>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct}%`, backgroundColor: LUDO_COLORS[color] },
                      ]}
                    />
                  </View>
                  {isLive && (
                    <View style={styles.diceRow}>
                      {[1, 2, 3, 4, 5, 6].map((v) => (
                        <Pressable
                          key={v}
                          testID={`force-dice-${color}-${v}`}
                          onPress={() => forceDice(color, v)}
                          style={[
                            styles.diceBtn,
                            forced === v && styles.diceBtnActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.diceBtnText,
                              forced === v && { color: C.onBrandPrimary },
                            ]}
                          >
                            {v}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Manipulation */}
        {isLive && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SET MATCH OUTCOME</Text>
            <Text style={styles.hintText}>
              Dice quietly favor the selected players — game looks 100% natural.
            </Text>
            <Text style={styles.rankLabel}>1ST PLACE (WINNER)</Text>
            <View style={styles.chipRow}>
              {players.map(([color, p]) => (
                <Pressable
                  key={color}
                  testID={`rank1-chip-${color}`}
                  onPress={() => {
                    haptic("light");
                    setRank1(rank1 === color ? "" : color);
                    if (rank2 === color) setRank2("");
                  }}
                  style={[
                    styles.rankChip,
                    rank1 === color && {
                      borderColor: LUDO_COLORS[color],
                      backgroundColor: `${LUDO_COLORS[color]}22`,
                    },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: LUDO_COLORS[color] }]} />
                  <Text style={styles.chipText}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.rankLabel}>2ND PLACE</Text>
            <View style={styles.chipRow}>
              {players.map(([color, p]) => (
                <Pressable
                  key={color}
                  testID={`rank2-chip-${color}`}
                  disabled={rank1 === color}
                  onPress={() => {
                    haptic("light");
                    setRank2(rank2 === color ? "" : color);
                  }}
                  style={[
                    styles.rankChip,
                    rank1 === color && { opacity: 0.3 },
                    rank2 === color && {
                      borderColor: LUDO_COLORS[color],
                      backgroundColor: `${LUDO_COLORS[color]}22`,
                    },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: LUDO_COLORS[color] }]} />
                  <Text style={styles.chipText}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Toast */}
      {toast !== "" && (
        <View style={[styles.toast, { bottom: 110 + insets.bottom }]} testID="control-toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Sticky CTA */}
      {isLive && (
        <View style={[styles.ctaBar, { paddingBottom: insets.bottom + SP.md }]}>
          <Pressable
            testID="clear-manipulation-button"
            onPress={clearManipulation}
            style={styles.clearBtn}
          >
            <Text style={styles.clearBtnText}>CLEAR</Text>
          </Pressable>
          <Pressable
            testID="apply-manipulation-button"
            onPress={applyManipulation}
            disabled={!rank1 && !rank2}
            style={[styles.applyBtn, !rank1 && !rank2 && { opacity: 0.4 }]}
          >
            <Ionicons name="flash" size={16} color={C.onBrandPrimary} />
            <Text style={styles.applyBtnText}>APPLY MANIPULATION</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  center: { alignItems: "center", justifyContent: "center", gap: SP.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    paddingHorizontal: SP.md,
    paddingBottom: SP.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  backBtn: { padding: 4 },
  headerCode: { flex: 1, fontFamily: F.display, fontSize: 28, color: C.onSurface, letterSpacing: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    paddingVertical: 4,
  },
  pulseDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: F.text, fontSize: 10, letterSpacing: 1 },
  metaLine: { fontFamily: F.text, fontSize: 11, color: C.onSurfaceTertiary, letterSpacing: 0.5 },
  section: {
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: SP.lg,
    gap: SP.md,
  },
  sectionTitle: { fontFamily: F.displaySemi, fontSize: 16, color: C.onSurfaceSecondary, letterSpacing: 1.5 },
  hintText: { fontFamily: F.text, fontSize: 11, color: C.onSurfaceTertiary },
  dimText: { fontFamily: F.text, fontSize: 12, color: C.onSurfaceTertiary },
  rollChip: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: SP.md,
    borderRadius: R.sm,
    borderWidth: 1,
    backgroundColor: C.surfaceTertiary,
  },
  rollValue: { fontFamily: F.display, fontSize: 18, color: C.onSurface },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotLg: { width: 14, height: 14, borderRadius: 7 },
  playerCard: {
    backgroundColor: C.surfaceTertiary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.sm,
    padding: SP.md,
    gap: SP.sm,
  },
  playerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  playerId: { flexDirection: "row", alignItems: "center", gap: SP.sm, flex: 1 },
  playerName: { fontFamily: F.text, fontSize: 14, color: C.onSurface },
  playerTags: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  turnBadge: {
    backgroundColor: "#26B36622",
    borderWidth: 1,
    borderColor: C.success,
    borderRadius: R.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  turnText: { fontFamily: F.text, fontSize: 9, color: C.success, letterSpacing: 1 },
  pctText: { fontFamily: F.displaySemi, fontSize: 15, color: C.onSurfaceSecondary },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: C.surface, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  diceRow: { flexDirection: "row", gap: SP.sm },
  diceBtn: {
    flex: 1,
    height: 38,
    borderRadius: R.sm,
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surfaceSecondary,
  },
  diceBtnActive: { backgroundColor: C.brandPrimary, borderColor: C.brandPrimary },
  diceBtnText: { fontFamily: F.displaySemi, fontSize: 17, color: C.onSurfaceSecondary },
  rankLabel: { fontFamily: F.text, fontSize: 10, color: C.onSurfaceTertiary, letterSpacing: 1.5 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm },
  rankChip: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: SP.md,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.surfaceTertiary,
  },
  chipText: { fontFamily: F.text, fontSize: 12, color: C.onSurface },
  winnerRow: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  winnerRank: { fontFamily: F.displaySemi, fontSize: 15, color: C.warning, width: 64 },
  winnerName: { fontFamily: F.text, fontSize: 14, color: C.onSurface },
  toast: {
    position: "absolute",
    left: SP.lg,
    right: SP.lg,
    backgroundColor: C.surfaceTertiary,
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: R.md,
    padding: SP.md,
    alignItems: "center",
  },
  toastText: { fontFamily: F.text, fontSize: 12, color: C.onSurface, textAlign: "center" },
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: SP.md,
    padding: SP.lg,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  clearBtn: {
    height: 50,
    paddingHorizontal: SP.xl,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.error,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: { fontFamily: F.displaySemi, fontSize: 15, color: C.error, letterSpacing: 1 },
  applyBtn: {
    flex: 1,
    height: 50,
    borderRadius: R.md,
    backgroundColor: C.brandPrimary,
    flexDirection: "row",
    gap: SP.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: { fontFamily: F.displaySemi, fontSize: 15, color: C.onBrandPrimary, letterSpacing: 1 },
});
