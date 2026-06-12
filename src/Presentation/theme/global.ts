import { Dimensions, Platform, StatusBar } from "react-native";

const { width, height } = Dimensions.get("window");

export type ThemeMode = "dark" | "light";

// export const BASE_COLORS = {
//   primary: "#00B8FF",
//   primarySoft: "#38D5FF",
//   primaryDark: "#0077B6",

//   cyan: "#00B8FF",
//   cyanSoft: "#67E8F9",
//   green: "#A3E635",
//   greenSoft: "#BEF264",
//   yellow: "#FACC15",
//   orange: "#FB923C",
//   red: "#F87171",
//   blue: "#2563EB",
//   pink: "#F9A8D4",
//   purple: "#A78BFA",

//   success: "#22C55E",
//   warning: "#FACC15",
//   danger: "#EF4444",
//   info: "#00B8FF",

//   white: "#FFFFFF",
//   black: "#000000",
// };

export const BASE_COLORS = {
  primary: "#3862B5",
  primarySoft: "#5478C4",
  primaryDark: "#294A8A",

  cyan: "#3862B5",
  cyanSoft: "#6F8DD5",

  green: "#408027",
  greenSoft: "#5E9C45",

  yellow: "#D4A72C",
  orange: "#C97A2B",

  red: "#A13135",
  redSoft: "#BD4A4F",

  blue: "#3862B5",
  pink: "#C06A87",
  purple: "#6B5FAF",

  success: "#408027",
  warning: "#D4A72C",
  danger: "#A13135",
  info: "#3862B5",

  white: "#FFFFFF",
  black: "#000000",
};

// export const DARK_COLORS = {
//   ...BASE_COLORS,
//   mode: "dark" as ThemeMode,

//   background: "#05080E",
//   backgroundAlt: "#07111C",
//   backgroundDeep: "#020617",

//   surface: "#0B1220",
//   surfaceSoft: "#111A2A",
//   surfaceStrong: "#0D1623",

//   card: "rgba(13, 22, 35, 0.58)",
//   cardStrong: "rgba(13, 22, 35, 0.72)",
//   cardElevated: "rgba(13, 22, 35, 0.78)",

//   overlay: "rgba(5, 8, 14, 0.38)",
//   overlayStrong: "rgba(0, 0, 0, 0.58)",
//   footerOverlay: "rgba(5, 8, 14, 0.96)",

//   primaryOverlay: "rgba(0, 184, 255, 0.12)",
//   primaryBorder: "rgba(0, 184, 255, 0.25)",

//   text: "#F8FAFC",
//   textSecondary: "#CBD5E1",
//   textMuted: "#94A3B8",
//   placeholder: "#64748B",

//   border: "rgba(255, 255, 255, 0.12)",
//   borderSoft: "rgba(255, 255, 255, 0.08)",
//   borderMuted: "rgba(255, 255, 255, 0.09)",
//   borderMedium: "rgba(255, 255, 255, 0.16)",
//   borderStrong: "rgba(255, 255, 255, 0.22)",
//   borderLight: "rgba(248, 250, 252, 0.42)",
//   borderWhite: "rgba(248, 250, 252, 0.72)",

//   mutedBg: "rgba(255, 255, 255, 0.05)",

//   tabBar: "#07111C",
//   input: "rgba(255, 255, 255, 0.045)",
//   gray: "#94A3B8",
// };

export const DARK_COLORS = {
  ...BASE_COLORS,
  mode: "dark" as ThemeMode,

  background: "#04070D",
  backgroundAlt: "#09111D",
  backgroundDeep: "#02040A",

  surface: "#0B1320",
  surfaceSoft: "#111C2C",
  surfaceStrong: "#162234",

  card: "rgba(17, 28, 44, 0.58)",
  cardStrong: "rgba(17, 28, 44, 0.72)",
  cardElevated: "rgba(17, 28, 44, 0.82)",

  overlay: "rgba(4, 7, 13, 0.42)",
  overlayStrong: "rgba(0, 0, 0, 0.62)",
  footerOverlay: "rgba(4, 7, 13, 0.96)",

  primaryOverlay: "rgba(56, 98, 181, 0.12)",
  primaryBorder: "rgba(56, 98, 181, 0.28)",

  text: "#F5F7FB",
  textSecondary: "#CBD5E1",
  textMuted: "#8D9AB0",
  placeholder: "#6B7285",

  border: "rgba(255,255,255,0.10)",
  borderSoft: "rgba(255,255,255,0.06)",
  borderMuted: "rgba(255,255,255,0.08)",
  borderMedium: "rgba(255,255,255,0.14)",
  borderStrong: "rgba(255,255,255,0.20)",
  borderLight: "rgba(255,255,255,0.35)",
  borderWhite: "rgba(255,255,255,0.72)",

  mutedBg: "rgba(255,255,255,0.04)",

  tabBar: "#09111D",
  input: "rgba(255,255,255,0.04)",
  gray: "#8D9AB0",
};

// export const LIGHT_COLORS = {
//   ...BASE_COLORS,
//   mode: "light" as ThemeMode,

//   background: "#F4F8FB",
//   backgroundAlt: "#EAF4FA",
//   backgroundDeep: "#E2EEF5",

//   surface: "#FFFFFF",
//   surfaceSoft: "#EEF7FC",
//   surfaceStrong: "#FFFFFF",

//   card: "rgba(255, 255, 255, 0.78)",
//   cardStrong: "rgba(255, 255, 255, 0.88)",
//   cardElevated: "rgba(255, 255, 255, 0.94)",

//   overlay: "rgba(244, 248, 251, 0.38)",
//   overlayStrong: "rgba(15, 23, 42, 0.42)",
//   footerOverlay: "rgba(244, 248, 251, 0.96)",

//   primaryOverlay: "rgba(0, 184, 255, 0.12)",
//   primaryBorder: "rgba(0, 184, 255, 0.25)",

//   text: "#101820",
//   textSecondary: "#334155",
//   textMuted: "#64748B",
//   placeholder: "#7C8794",

//   border: "rgba(15, 23, 42, 0.10)",
//   borderSoft: "rgba(15, 23, 42, 0.08)",
//   borderMuted: "rgba(15, 23, 42, 0.09)",
//   borderMedium: "rgba(15, 23, 42, 0.14)",
//   borderStrong: "rgba(15, 23, 42, 0.18)",
//   borderLight: "rgba(15, 23, 42, 0.30)",
//   borderWhite: "rgba(255, 255, 255, 0.72)",

//   mutedBg: "rgba(15, 23, 42, 0.05)",

//   tabBar: "#101820",
//   input: "rgba(255, 255, 255, 0.88)",
//   gray: "#64748B",
// };

export const LIGHT_COLORS = {
  ...BASE_COLORS,
  mode: "light" as ThemeMode,

  background: "#F4F6FA",
  backgroundAlt: "#EEF2F8",
  backgroundDeep: "#E5EBF5",

  surface: "#FFFFFF",
  surfaceSoft: "#F7F9FC",
  surfaceStrong: "#FFFFFF",

  card: "rgba(255,255,255,0.78)",
  cardStrong: "rgba(255,255,255,0.88)",
  cardElevated: "rgba(255,255,255,0.94)",

  overlay: "rgba(244,246,250,0.40)",
  overlayStrong: "rgba(4,7,13,0.42)",
  footerOverlay: "rgba(244,246,250,0.96)",

  primaryOverlay: "rgba(56,98,181,0.10)",
  primaryBorder: "rgba(56,98,181,0.22)",

  text: "#101828",
  textSecondary: "#344054",
  textMuted: "#667085",
  placeholder: "#98A2B3",

  border: "rgba(16,24,40,0.10)",
  borderSoft: "rgba(16,24,40,0.06)",
  borderMuted: "rgba(16,24,40,0.08)",
  borderMedium: "rgba(16,24,40,0.14)",
  borderStrong: "rgba(16,24,40,0.20)",
  borderLight: "rgba(16,24,40,0.28)",
  borderWhite: "rgba(255,255,255,0.72)",

  mutedBg: "rgba(16,24,40,0.04)",

  tabBar: "#FFFFFF",
  input: "rgba(255,255,255,0.90)",
  gray: "#667085",
};

export const COLORS = DARK_COLORS;

export const FONT = {
  family: {
    regular: "System",
    medium: "System",
    bold: "System",
  },
  size: {
    xxs: 10,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36,
  },
  lineHeight: {
    xs: 16,
    sm: 19,
    md: 21,
    lg: 24,
    xl: 32,
    xxl: 38,
  },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
    black: "900" as const,
  },
  letterSpacing: {
    tight: -1.1,
    normal: 0,
    wide: 2,
  },
};

export const SPACING = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
  xxxl: 56,
};

export const BORDER_RADIUS = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const LAYOUT = {
  screenPadding: 22,
  screenPaddingCompact: 18,
  headerTopPadding:
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 24 : 36,
  headerTopPaddingLarge:
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) + 32 : 48,
  footerPaddingBottom: 18,
};

export const SIZES = {
  screenWidth: width,
  screenHeight: height,
  statusBarHeight: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 44,

  logoSm: 72,
  logoMd: 90,
  logoLg: 110,

  iconSm: 32,
  iconMd: 38,
  iconLg: 48,

  buttonHeight: 52,
  inputHeight: 52,
};

// export const SHADOWS = {
//   card: {
//     shadowColor: "#000",
//     shadowOpacity: 0.32,
//     shadowRadius: 22,
//     shadowOffset: { width: 0, height: 14 },
//     elevation: 10,
//   },
//   glow: {
//     shadowColor: "#00B8FF",
//     shadowOpacity: 0.35,
//     shadowRadius: 18,
//     shadowOffset: { width: 0, height: 0 },
//     elevation: 8,
//   },
// };

export const SHADOWS = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },

  glow: {
    shadowColor: "#3862B5",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
};

export const getTheme = (mode: ThemeMode = "dark") => ({
  mode,
  COLORS: mode === "dark" ? DARK_COLORS : LIGHT_COLORS,
  FONT,
  SPACING,
  BORDER_RADIUS,
  LAYOUT,
  SIZES,
  SHADOWS,
});

const theme = getTheme("dark");

export default theme;