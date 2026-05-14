// jide — design tokens (light/dark + accent palette)
// Derived from Yurest tokens, with a warm-dark mode for terminal work.

const JIDE_LIGHT = {
  // surfaces
  appBg: "#F5F2EE",          // window chrome (warm)
  panelBg: "#FFFFFF",        // main content
  panelMuted: "#FAFAFA",
  sidebarBg: "#F8F6F2",
  tabbarBg: "#F2EFEA",
  inputBg: "#FFFFFF",
  codeBg: "#F5F5F5",
  hoverBg: "rgba(31,31,31,0.04)",
  selectedBg: "rgba(31,31,31,0.07)",
  // borders
  border: "#EBEBEB",
  borderStrong: "#DBDBDB",
  borderHair: "#E6E3DE",
  // text
  text: "#1F1F1F",
  textMed: "#666666",
  textLow: "#8F8F8F",
  textDisabled: "#B8B8B8",
  // semantic
  diffAddBg: "#ECFDF0",
  diffAddText: "#028E5C",
  diffDelBg: "#FEF3F2",
  diffDelText: "#DA3D28",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#ED5A46",
  info: "#3B82F6",
  // shadows
  cardShadow: "0 1px 2px rgba(31,31,31,0.04)",
  popoverShadow: "0 8px 24px rgba(31,31,31,0.12)",
  modalShadow: "0 24px 64px rgba(0,0,0,0.18)",
  scrim: "rgba(20,18,15,0.45)",
};

const JIDE_DARK = {
  appBg: "#0D0C10",
  panelBg: "#16151A",
  panelMuted: "#1B1A1F",
  sidebarBg: "#121116",
  tabbarBg: "#0F0E12",
  inputBg: "#1F1E24",
  codeBg: "#1B1A20",
  hoverBg: "rgba(255,255,255,0.04)",
  selectedBg: "rgba(255,255,255,0.07)",
  border: "#26252C",
  borderStrong: "#36353E",
  borderHair: "#1F1E25",
  text: "#F0EFEC",
  textMed: "#9A9A9F",
  textLow: "#6E6E76",
  textDisabled: "#4A4A52",
  diffAddBg: "rgba(16,185,129,0.10)",
  diffAddText: "#34D399",
  diffDelBg: "rgba(237,90,70,0.12)",
  diffDelText: "#F08A7C",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#ED5A46",
  info: "#3B82F6",
  cardShadow: "0 1px 0 rgba(255,255,255,0.02)",
  popoverShadow: "0 8px 32px rgba(0,0,0,0.5)",
  modalShadow: "0 24px 64px rgba(0,0,0,0.6)",
  scrim: "rgba(0,0,0,0.55)",
};

const JIDE_ACCENTS = {
  coral:    { id: "coral",    name: "Coral",    value: "#F95A5C", light: "#FF7173", bg: "#FFECEC", bgDim: "#FFF5F5", darkBg: "rgba(249,90,92,0.14)" },
  violet:   { id: "violet",   name: "Violeta",  value: "#7C67F7", light: "#9D8DFA", bg: "#EEEAFF", bgDim: "#F4F2FF", darkBg: "rgba(124,103,247,0.18)" },
  emerald:  { id: "emerald",  name: "Esmeralda",value: "#10B981", light: "#34D399", bg: "#D1FAE5", bgDim: "#ECFDF0", darkBg: "rgba(16,185,129,0.16)" },
  electric: { id: "electric", name: "Eléctrico",value: "#3B82F6", light: "#60A5FA", bg: "#DBEAFE", bgDim: "#EFF6FF", darkBg: "rgba(59,130,246,0.18)" },
};

// Density presets — affect row heights, paddings, font baselines.
const JIDE_DENSITY = {
  compact: { row: 24, gap: 4,  pad: 8,  side: 244, tabH: 32, font: 12.5, mono: 12 },
  comfy:   { row: 30, gap: 6,  pad: 12, side: 280, tabH: 36, font: 13.5, mono: 13 },
};

function useTheme(mode) { return mode === "dark" ? JIDE_DARK : JIDE_LIGHT; }

Object.assign(window, { JIDE_LIGHT, JIDE_DARK, JIDE_ACCENTS, JIDE_DENSITY, useTheme });
