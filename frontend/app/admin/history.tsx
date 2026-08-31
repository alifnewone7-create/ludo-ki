import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { onValue, ref } from "firebase/database";
import { db, Match } from "@/src/lib/firebase";
import { C, F, LUDO_COLORS, SP, timeAgo } from "@/src/theme";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    const unsub = onValue(ref(db, "matches"), (snap) => {
      const val = snap.val() || {};
      const list: Match[] = (Object.values(val) as Match[]).filter(
        (m) => m.status !== "live"
      );
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setMatches(list);
    });
    return unsub;
  }, []);

  return (
    <View style={styles.root} testID="history-screen">
      <View style={[styles.header, { paddingTop: insets.top + SP.md }]}>
        <Text style={styles.headerTitle}>MATCH HISTORY</Text>
        <Text style={styles.headerSub}>Finished & abandoned matches</Text>
      </View>
      {matches === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.brandPrimary} />
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.center} testID="history-empty-state">
          <Ionicons name="archive-outline" size={40} color={C.onSurfaceTertiary} />
          <Text style={styles.dimText}>No finished matches yet.</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.code}
          contentContainerStyle={{ paddingBottom: insets.bottom + SP.xl }}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          renderItem={({ item }) => {
            const winners = Object.entries(item.winners || {}).sort(
              ([a], [b]) => Number(a) - Number(b)
            );
            return (
              <View style={styles.row} testID={`history-row-${item.code}`}>
                <View style={styles.rowLeft}>
                  <Text style={styles.code}>#{item.code}</Text>
                  <Text style={styles.meta}>
                    {timeAgo(item.finishedAt || item.createdAt)} ·{" "}
                    {item.status === "abandoned" ? "ABANDONED" : "FINISHED"}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  {winners.length === 0 ? (
                    <Text style={styles.meta}>—</Text>
                  ) : (
                    winners.slice(0, 2).map(([pos, w]) => (
                      <View key={pos} style={styles.winnerPill}>
                        <Text style={styles.rankNum}>{pos === "1" ? "1ST" : pos === "2" ? "2ND" : `${pos}TH`}</Text>
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: LUDO_COLORS[w.color] || C.onSurfaceTertiary },
                          ]}
                        />
                        <Text style={styles.winnerName} numberOfLines={1}>
                          {w.name || w.color}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  header: {
    paddingHorizontal: SP.lg,
    paddingBottom: SP.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontFamily: F.display, fontSize: 26, color: C.onSurface, letterSpacing: 1 },
  headerSub: { fontFamily: F.text, fontSize: 12, color: C.onSurfaceTertiary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP.md },
  dimText: { fontFamily: F.text, fontSize: 13, color: C.onSurfaceTertiary },
  divider: { height: 1, backgroundColor: C.divider },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP.lg,
    paddingVertical: SP.md,
    gap: SP.md,
  },
  rowLeft: { gap: 2 },
  code: { fontFamily: F.displaySemi, fontSize: 20, color: C.onSurface, letterSpacing: 1 },
  meta: { fontFamily: F.text, fontSize: 11, color: C.onSurfaceTertiary },
  rowRight: { gap: 4, alignItems: "flex-end" },
  winnerPill: { flexDirection: "row", alignItems: "center", gap: 6 },
  rankNum: { fontFamily: F.text, fontSize: 10, color: C.warning, letterSpacing: 0.5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  winnerName: { fontFamily: F.text, fontSize: 12, color: C.onSurfaceSecondary, maxWidth: 120 },
});
