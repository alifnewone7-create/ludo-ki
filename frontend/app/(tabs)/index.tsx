import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { onValue, ref } from "firebase/database";
import { db, Match, GAME_TYPES } from "@/src/lib/firebase";
import { C, F, LUDO_COLORS, R, SP, timeAgo } from "@/src/theme";

export default function LiveMatchesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [connected, setConnected] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubM = onValue(ref(db, "matches"), (snap) => {
      const val = snap.val() || {};
      const list: Match[] = Object.values(val);
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setMatches(list);
    });
    const unsubC = onValue(ref(db, ".info/connected"), (snap) =>
      setConnected(!!snap.val())
    );
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => {
      unsubM();
      unsubC();
      clearInterval(t);
    };
  }, []);

  const live = (matches || []).filter((m) => m.status === "live");

  return (
    <View style={styles.root} testID="live-matches-screen">
      <View style={[styles.header, { paddingTop: insets.top + SP.md }]}>
        <View>
          <Text style={styles.headerTitle}>LUDO OPS</Text>
          <Text style={styles.headerSub}>Match Control Center</Text>
        </View>
        <View style={styles.connPill} testID="firebase-connection-status">
          <View
            style={[
              styles.connDot,
              { backgroundColor: connected ? C.success : C.error },
            ]}
          />
          <Text style={styles.connText}>
            {connected ? "CONNECTED" : "OFFLINE"}
          </Text>
        </View>
      </View>

      {matches === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.brandPrimary} />
          <Text style={styles.dimText}>Establishing Firebase connection...</Text>
        </View>
      ) : live.length === 0 ? (
        <View style={styles.center} testID="live-empty-state">
          <Ionicons name="game-controller-outline" size={44} color={C.onSurfaceTertiary} />
          <Text style={styles.emptyTitle}>No active matches right now</Text>
          <Text style={styles.dimText}>
            Ludo game-এ ম্যাচ শুরু হলেই এখানে live দেখাবে
          </Text>
        </View>
      ) : (
        <FlatList
          data={live}
          keyExtractor={(m) => m.code}
          contentContainerStyle={{
            padding: SP.lg,
            paddingBottom: insets.bottom + SP.xl,
            gap: SP.md,
          }}
          renderItem={({ item }) => (
            <Pressable
              testID={`match-card-${item.code}`}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/match/${item.code}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.matchCode}>#{item.code}</Text>
                <View style={styles.liveBadge}>
                  <View style={styles.livePulse} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.metaText}>
                  {GAME_TYPES[item.gametype] || "CLASSIC"} · {item.nop} PLAYERS ·{" "}
                  {timeAgo(item.createdAt)}
                </Text>
              </View>
              <View style={styles.playerRow}>
                {Object.entries(item.players || {}).map(([color, p]) => (
                  <View key={color} style={styles.playerPill}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: LUDO_COLORS[color] || C.onSurfaceTertiary },
                      ]}
                    />
                    <Text style={styles.playerName} numberOfLines={1}>
                      {p.name}
                      {p.isBot ? " (bot)" : ""}
                    </Text>
                  </View>
                ))}
              </View>
              {(item.control?.ranks &&
                Object.keys(item.control.ranks).length > 0) ||
              (item.control?.force &&
                Object.values(item.control.force).some((v) => v > 0)) ? (
                <View style={styles.rigBadge}>
                  <Ionicons name="flash" size={11} color={C.onBrandTertiary} />
                  <Text style={styles.rigText}>MANIPULATION ACTIVE</Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: SP.lg,
    paddingBottom: SP.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  headerTitle: { fontFamily: F.display, fontSize: 30, color: C.onSurface, letterSpacing: 1 },
  headerSub: { fontFamily: F.text, fontSize: 12, color: C.onSurfaceTertiary },
  connPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    paddingVertical: 6,
    marginBottom: 4,
  },
  connDot: { width: 8, height: 8, borderRadius: 4 },
  connText: { fontFamily: F.text, fontSize: 10, color: C.onSurfaceSecondary, letterSpacing: 0.5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP.md, padding: SP.xl },
  dimText: { fontFamily: F.text, fontSize: 13, color: C.onSurfaceTertiary, textAlign: "center" },
  emptyTitle: { fontFamily: F.displaySemi, fontSize: 20, color: C.onSurfaceSecondary },
  card: {
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: SP.lg,
    gap: SP.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  matchCode: { fontFamily: F.display, fontSize: 34, color: C.onSurface, letterSpacing: 2 },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#26B36622",
    borderWidth: 1,
    borderColor: C.success,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    paddingVertical: 4,
  },
  livePulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.success },
  liveText: { fontFamily: F.text, fontSize: 10, color: C.success, letterSpacing: 1 },
  cardMeta: {},
  metaText: { fontFamily: F.text, fontSize: 11, color: C.onSurfaceTertiary, letterSpacing: 0.5 },
  playerRow: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm },
  playerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surfaceTertiary,
    borderRadius: R.pill,
    paddingHorizontal: SP.md,
    paddingVertical: 5,
    maxWidth: 150,
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  playerName: { fontFamily: F.text, fontSize: 12, color: C.onSurfaceSecondary },
  rigBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: C.brandTertiary,
    borderRadius: R.sm,
    paddingHorizontal: SP.sm,
    paddingVertical: 3,
  },
  rigText: { fontFamily: F.text, fontSize: 9, color: C.onBrandTertiary, letterSpacing: 1 },
});
