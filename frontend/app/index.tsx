import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { C, F, R, SP } from "@/src/theme";

export default function Launcher() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top + SP.xxl }]} testID="launcher-screen">
      <View style={styles.hero}>
        <Text style={styles.brand}>LUDO 6</Text>
        <Text style={styles.tagline}>5 ও 6 জনের হেক্সাগন লুডো + কন্ট্রোল প্যানেল</Text>
      </View>

      <View style={styles.cards}>
        <Pressable
          testID="launch-play-button"
          style={({ pressed }) => [pressed && { opacity: 0.9 }]}
          onPress={() => router.push("/play/setup")}
        >
          <LinearGradient
            colors={[C.brandPrimary, C.brandSecondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.playCard}
          >
            <Ionicons name="dice" size={40} color={C.onBrandPrimary} />
            <Text style={styles.playTitle}>খেলা শুরু করুন</Text>
            <Text style={styles.playSub}>5 বা 6 জন · একই ফোনে পালা করে</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          testID="launch-admin-button"
          style={({ pressed }) => [styles.adminCard, pressed && { opacity: 0.9 }]}
          onPress={() => router.push("/admin")}
        >
          <Ionicons name="options" size={26} color={C.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.adminTitle}>Admin Control Panel</Text>
            <Text style={styles.adminSub}>Live ম্যাচ দেখুন ও নিয়ন্ত্রণ করুন</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.onSurfaceTertiary} />
        </Pressable>
      </View>

      <Text style={styles.note}>
        2/3/4 জনের ক্লাসিক গেম আলাদা Android অ্যাপে চলে। এই অ্যাপে 5/6 জনের হেক্সাগন
        বোর্ড ও Admin প্যানেল।
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface, padding: SP.xl },
  hero: { marginTop: SP.xxl, marginBottom: SP.xxl },
  brand: { fontFamily: F.display, fontSize: 64, color: C.onSurface, letterSpacing: 2 },
  tagline: { fontFamily: F.text, fontSize: 14, color: C.onSurfaceTertiary, marginTop: SP.xs },
  cards: { gap: SP.lg },
  playCard: {
    borderRadius: R.lg,
    padding: SP.xl,
    gap: SP.sm,
    alignItems: "flex-start",
  },
  playTitle: { fontFamily: F.display, fontSize: 30, color: C.onBrandPrimary, marginTop: SP.sm },
  playSub: { fontFamily: F.text, fontSize: 13, color: C.onBrandPrimary, opacity: 0.85 },
  adminCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.surfaceSecondary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: SP.lg,
  },
  adminTitle: { fontFamily: F.displaySemi, fontSize: 18, color: C.onSurface },
  adminSub: { fontFamily: F.text, fontSize: 12, color: C.onSurfaceTertiary },
  note: {
    fontFamily: F.text,
    fontSize: 12,
    color: C.onSurfaceTertiary,
    marginTop: "auto",
    lineHeight: 18,
  },
});
