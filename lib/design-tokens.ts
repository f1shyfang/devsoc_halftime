export const tokens = {
  fonts: {
    display: "var(--font-instrument-serif), serif",
    body: "var(--font-geist-sans), sans-serif",
  },
  colors: {
    bg: "#000000",
    bgSoft: "#0a0a0a",
    text: "#fafafa",
    dim: "#888888",
    accent: "#ff7a00",
  },
  motion: {
    rowInsertMs: 200,
    rowInsertEasing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    rowPulseMs: 1500,
    rowStaggerMs: 50,
  },
  layout: {
    minTouchTarget: 44,
    projectorWidth: 1920,
    projectorHeightMin: 720,
    mobileMinWidth: 375,
  },
} as const;
