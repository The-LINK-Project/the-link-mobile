// Design tokens lifted from the web app's globals.css (light theme). Keep
// these in sync with app/[locale]/globals.css so the app and site match.
export const colors = {
    background: "#fcfcfc",
    surface: "#ffffff",
    foreground: "#171717",
    muted: "#6b7280",
    mutedSurface: "#f3f4f6",
    border: "#dfdfdf",
    hairline: "#ececec",

    primary: "#72e3ad",
    // WCAG-checked (31 Aug 2026): primaryDark on white ≈ 5.3:1, onPrimary on
    // primary ≈ 7.8:1, warning on warningSoft ≈ 4.8:1 — all ≥ 4.5:1 for
    // small text. Don't lighten these without re-checking.
    primaryDark: "#1b7a50",
    primarySoft: "#e8faf1",
    onPrimary: "#0b3d27",

    accent: "#5ac7db",
    accentSoft: "#e6f7fa",

    success: "#15803d",
    successSoft: "#dcfce7",
    warning: "#946300",
    warningSoft: "#fef9c3",
    destructive: "#ca3214",
    destructiveSoft: "#fee2e2",

    white: "#ffffff",
    black: "#000000",
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
} as const;

export const radius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
} as const;

export const fontSize = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
} as const;

export const shadow = {
    card: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    raised: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
    },
} as const;

/** Minimum touch target per Android accessibility guidance. */
export const TOUCH_TARGET = 48;
