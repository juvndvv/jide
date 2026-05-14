export type ThemeMode = 'light' | 'dark' | 'auto';
export type SidebarSide = 'left' | 'right';

export interface ThemeTokens {
  appBg: string;
  panelBg: string;
  panelMuted: string;
  sidebarBg: string;
  tabbarBg: string;
  inputBg: string;
  codeBg: string;
  hoverBg: string;
  selectedBg: string;
  border: string;
  borderStrong: string;
  borderHair: string;
  text: string;
  textMed: string;
  textLow: string;
  textDisabled: string;
  diffAddBg: string;
  diffAddText: string;
  diffDelBg: string;
  diffDelText: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  cardShadow: string;
  popoverShadow: string;
  modalShadow: string;
  scrim: string;
}

export const THEME_LIGHT: ThemeTokens = {
  appBg: '#F5F2EE',
  panelBg: '#FFFFFF',
  panelMuted: '#FAFAFA',
  sidebarBg: '#F8F6F2',
  tabbarBg: '#F2EFEA',
  inputBg: '#FFFFFF',
  codeBg: '#F5F5F5',
  hoverBg: 'rgba(31,31,31,0.04)',
  selectedBg: 'rgba(31,31,31,0.07)',
  border: '#EBEBEB',
  borderStrong: '#DBDBDB',
  borderHair: '#E6E3DE',
  text: '#1F1F1F',
  textMed: '#666666',
  textLow: '#8F8F8F',
  textDisabled: '#B8B8B8',
  diffAddBg: '#ECFDF0',
  diffAddText: '#028E5C',
  diffDelBg: '#FEF3F2',
  diffDelText: '#DA3D28',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#ED5A46',
  info: '#3B82F6',
  cardShadow: '0 1px 2px rgba(31,31,31,0.04)',
  popoverShadow: '0 8px 24px rgba(31,31,31,0.12)',
  modalShadow: '0 24px 64px rgba(0,0,0,0.18)',
  scrim: 'rgba(20,18,15,0.45)',
};

export const THEME_DARK: ThemeTokens = {
  appBg: '#0D0C10',
  panelBg: '#16151A',
  panelMuted: '#1B1A1F',
  sidebarBg: '#121116',
  tabbarBg: '#0F0E12',
  inputBg: '#1F1E24',
  codeBg: '#1B1A20',
  hoverBg: 'rgba(255,255,255,0.04)',
  selectedBg: 'rgba(255,255,255,0.07)',
  border: '#26252C',
  borderStrong: '#36353E',
  borderHair: '#1F1E25',
  text: '#F0EFEC',
  textMed: '#9A9A9F',
  textLow: '#6E6E76',
  textDisabled: '#4A4A52',
  diffAddBg: 'rgba(16,185,129,0.10)',
  diffAddText: '#34D399',
  diffDelBg: 'rgba(237,90,70,0.12)',
  diffDelText: '#F08A7C',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#ED5A46',
  info: '#3B82F6',
  cardShadow: '0 1px 0 rgba(255,255,255,0.02)',
  popoverShadow: '0 8px 32px rgba(0,0,0,0.5)',
  modalShadow: '0 24px 64px rgba(0,0,0,0.6)',
  scrim: 'rgba(0,0,0,0.55)',
};

export type AccentId = 'coral' | 'violet' | 'emerald' | 'electric';

export interface AccentTokens {
  id: AccentId;
  name: string;
  value: string;
  light: string;
  bg: string;
  bgDim: string;
  darkBg: string;
}

export const ACCENTS: Record<AccentId, AccentTokens> = {
  coral: { id: 'coral', name: 'Coral', value: '#F95A5C', light: '#FF7173', bg: '#FFECEC', bgDim: '#FFF5F5', darkBg: 'rgba(249,90,92,0.14)' },
  violet: { id: 'violet', name: 'Violeta', value: '#7C67F7', light: '#9D8DFA', bg: '#EEEAFF', bgDim: '#F4F2FF', darkBg: 'rgba(124,103,247,0.18)' },
  emerald: { id: 'emerald', name: 'Esmeralda', value: '#10B981', light: '#34D399', bg: '#D1FAE5', bgDim: '#ECFDF0', darkBg: 'rgba(16,185,129,0.16)' },
  electric: { id: 'electric', name: 'Eléctrico', value: '#3B82F6', light: '#60A5FA', bg: '#DBEAFE', bgDim: '#EFF6FF', darkBg: 'rgba(59,130,246,0.18)' },
};

export type DensityId = 'compact' | 'comfy';

export interface DensityTokens {
  row: number;
  gap: number;
  pad: number;
  side: number;
  tabH: number;
  font: number;
  mono: number;
}

export const DENSITIES: Record<DensityId, DensityTokens> = {
  compact: { row: 24, gap: 4, pad: 8, side: 244, tabH: 32, font: 12.5, mono: 12 },
  comfy: { row: 30, gap: 6, pad: 12, side: 280, tabH: 36, font: 13.5, mono: 13 },
};
