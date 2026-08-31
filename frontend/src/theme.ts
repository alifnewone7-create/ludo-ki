export const C = {
  surface: "#0F1115",
  onSurface: "#F2F4F7",
  surfaceSecondary: "#1C1F26",
  onSurfaceSecondary: "#D1D5DB",
  surfaceTertiary: "#282C35",
  onSurfaceTertiary: "#9CA3AF",
  brand: "#F56A25",
  brandPrimary: "#FF7A33",
  onBrandPrimary: "#1A0902",
  brandTertiary: "#4D2C1B",
  onBrandTertiary: "#FFC4A6",
  success: "#26B366",
  warning: "#F5A623",
  error: "#E04343",
  border: "#2A2F3A",
  borderStrong: "#3D4454",
  divider: "#1F232B",
  ludoRed: "#FF5A5A",
  ludoGreen: "#4ADE80",
  ludoYellow: "#FBBF24",
  ludoBlue: "#60A5FA",
};

export const LUDO_COLORS: Record<string, string> = {
  red: C.ludoRed,
  green: C.ludoGreen,
  yellow: C.ludoYellow,
  blue: C.ludoBlue,
};

export const F = {
  display: "BarlowCondensed-Bold",
  displaySemi: "BarlowCondensed-SemiBold",
  text: "DMSans",
};

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const R = { sm: 6, md: 12, lg: 20, pill: 999 };

export function timeAgo(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
