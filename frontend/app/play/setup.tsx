import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SEAT_COLORS } from "@/src/game/engine";
import { C, F, LUDO_COLORS, R, SP } from "@/src/theme";

interface SeatCfg {
  name: string;
  isBot: boolean;
}

export default function Setup() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [count, setCount] = useState<5 | 6>(6);
  const [seats, setSeats] = useState<SeatCfg[]>(
    Array.from({ length: 6 }, (_, i) => ({ name: `Player ${i + 1}`, isBot: false }))
  );

  const update = (i: number, patch: Partial<SeatCfg>) =>
    setSeats((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const start = () => {
    const active = seats.slice(0, count).map((s, seat) => ({
      seat,
      name: s.name.trim() || `Player ${seat + 1}`,
      isBot: s.isBot,
    }));
    router.push({
      pathname: "/play/game",
      params: { seats: JSON.stringify(active) },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + SP.sm }]}>
        <Pressable testID="setup-back" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>NEW GAME</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SP.lg, paddingBottom: insets.bottom + 100, gap: SP.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>কত জন খেলবে?</Text>
        <View style={styles.countRow}>
          {[5, 6].map((n) => (
            <Pressable
              key={n}
              testID={`count-${n}`}
              onPress={() => setCount(n as 5 | 6)}
              style={[styles.countBtn, count === n && styles.countBtnActive]}
            >
              <Text style={[styles.countText, count === n && { color: C.onBrandPrimary }]}>
                {n} জন
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: SP.md }}>
          {seats.slice(0, count).map((s, i) => (
            <View key={i} style={styles.seatRow} testID={`seat-${i}`}>
              <View style={[styles.dot, { backgroundColor: LUDO_COLORS[SEAT_COLORS[i]] }]} />
              <TextInput
                testID={`seat-name-${i}`}
                value={s.name}
                onChangeText={(t) => update(i, { name: t })}
                placeholder={`Player ${i + 1}`}
                placeholderTextColor={C.onSurfaceTertiary}
                style={styles.input}
                maxLength={14}
              />
              <Pressable
                testID={`seat-bot-${i}`}
                onPress={() => update(i, { isBot: !s.isBot })}
                style={[styles.botBtn, s.isBot && styles.botBtnActive]}
              >
                <Ionicons
                  name={s.isBot ? "hardware-chip" : "person"}
                  size={14}
                  color={s.isBot ? C.onBrandPrimary : C.onSurfaceSecondary}
                />
                <Text style={[styles.botText, s.isBot && { color: C.onBrandPrimary }]}>
                  {s.isBot ? "Bot" : "Human"}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + SP.md }]}>
        <Pressable testID="start-game-button" onPress={start} style={styles.startBtn}>
          <Ionicons name="play" size={18} color={C.onBrandPrimary} />
          <Text style={styles.startText}>খেলা শুরু</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SP.md,
    paddingBottom: SP.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontFamily: F.display, fontSize: 24, color: C.onSurface, letterSpacing: 1 },
  label: { fontFamily: F.displaySemi, fontSize: 16, color: C.onSurfaceSecondary, letterSpacing: 1 },
  countRow: { flexDirection: "row", gap: SP.md },
  countBtn: {
    flex: 1,
    height: 52,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surfaceSecondary,
  },
  countBtnActive: { backgroundColor: C.brandPrimary, borderColor: C.brandPrimary },
  countText: { fontFamily: F.displaySemi, fontSize: 20, color: C.onSurfaceSecondary },
  seatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: SP.md,
  },
  dot: { width: 18, height: 18, borderRadius: 9 },
  input: {
    flex: 1,
    fontFamily: F.text,
    fontSize: 15,
    color: C.onSurface,
    paddingVertical: SP.sm,
  },
  botBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.borderStrong,
    paddingHorizontal: SP.md,
    paddingVertical: 6,
    backgroundColor: C.surfaceTertiary,
  },
  botBtnActive: { backgroundColor: C.brandPrimary, borderColor: C.brandPrimary },
  botText: { fontFamily: F.text, fontSize: 12, color: C.onSurfaceSecondary },
  ctaBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: SP.lg,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  startBtn: {
    height: 52,
    borderRadius: R.md,
    backgroundColor: C.brandPrimary,
    flexDirection: "row",
    gap: SP.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  startText: { fontFamily: F.displaySemi, fontSize: 17, color: C.onBrandPrimary, letterSpacing: 1 },
});
