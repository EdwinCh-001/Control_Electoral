import { Platform, type TextStyle, type ViewStyle } from "react-native";

function font(ios: string, android: string): string {
  return Platform.select({ ios, android, default: "System" }) ?? "System";
}

/**
 * Paleta ADN-7 de Control Electoral.
 *
 * Proporción visual sugerida: 30% blanco, 50% morado y 20% amarillo.
 * Los alias históricos se conservan para no romper estilos existentes;
 * el código nuevo debe usar los nombres semánticos.
 */
export const colors = {
  background: "#FFFFFF",
  surface: "#F7F5FA",
  border: "#E2DCEB",

  primary: "#5B2384",
  primaryDark: "#431763",
  primarySoft: "#7A3FB0",

  accent: "#E6E73A",
  accentBright: "#F2F02E",
  accentDeep: "#9E8B00",

  ink: "#431763",
  inkMuted: "rgba(67, 23, 99, 0.72)",
  onPrimary: "#FFFFFF",
  onPrimaryMuted: "rgba(255, 255, 255, 0.86)",

  primarySoftBg: "rgba(91, 35, 132, 0.10)",
  accentSoft: "rgba(230, 231, 58, 0.24)",
  surfaceSoft: "rgba(247, 245, 250, 0.92)",
  backgroundGlass: "rgba(255, 255, 255, 0.94)",

  /* Alias de compatibilidad con estilos anteriores. */
  navy: "#FFFFFF",
  navyDeep: "#F7F5FA",
  navyBorder: "#E2DCEB",
  red: "#5B2384",
  white: "#431763",
  bone: "#431763",
  boneMuted: "rgba(67, 23, 99, 0.72)",
  amber: "#9E8B00",
  emerald: "#5B2384",
  redSoft: "rgba(91, 35, 132, 0.10)",
  amberSoft: "rgba(230, 231, 58, 0.24)",
  emeraldSoft: "rgba(91, 35, 132, 0.10)",
  boneSoft: "rgba(247, 245, 250, 0.92)",
  navyGlass: "rgba(255, 255, 255, 0.94)",
} as const;

export const fonts = {
  display: font("AvenirNext-DemiBold", "sans-serif"),
  body: font("AvenirNext-Regular", "sans-serif"),
  bodyMedium: font("AvenirNext-Medium", "sans-serif-medium"),
  bodyBold: font("AvenirNext-DemiBold", "sans-serif-medium"),
  mono: font("Menlo", "monospace"),
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  display: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: colors.primaryDark,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: colors.primaryDark,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.inkMuted,
  },
  section: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.primary,
    letterSpacing: 0.1,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
  },
  small: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkMuted,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 17,
    color: colors.inkMuted,
    letterSpacing: 0.2,
  },
  button: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.onPrimary,
  },
  numeric: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: colors.primaryDark,
  },
} satisfies Record<string, TextStyle>;

export const surface: ViewStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: radii.lg,
};
