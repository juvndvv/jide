import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  THEME_LIGHT,
  THEME_DARK,
  ACCENTS,
  DENSITIES,
  type ThemeTokens,
  type AccentId,
  type DensityId,
  type ThemeMode,
  type SidebarSide,
} from '@shared/theme';

describe('theme tokens', () => {
  it('light and dark share the same shape', () => {
    expect(Object.keys(THEME_DARK).sort()).toEqual(Object.keys(THEME_LIGHT).sort());
  });

  it('exposes the four canonical accents', () => {
    expect(Object.keys(ACCENTS).sort()).toEqual(['coral', 'electric', 'emerald', 'violet']);
    expectTypeOf<AccentId>().toEqualTypeOf<'coral' | 'violet' | 'emerald' | 'electric'>();
  });

  it('exposes compact and comfy densities only', () => {
    expect(Object.keys(DENSITIES).sort()).toEqual(['comfy', 'compact']);
    expectTypeOf<DensityId>().toEqualTypeOf<'compact' | 'comfy'>();
  });

  it('density tokens are numeric and positive', () => {
    for (const d of Object.values(DENSITIES)) {
      for (const v of Object.values(d)) {
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThan(0);
      }
    }
  });

  it('accent.value is a hex color', () => {
    for (const a of Object.values(ACCENTS)) {
      expect(a.value).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('ThemeMode covers the three modes', () => {
    expectTypeOf<ThemeMode>().toEqualTypeOf<'light' | 'dark' | 'auto'>();
    expectTypeOf<SidebarSide>().toEqualTypeOf<'left' | 'right'>();
  });

  it('theme tokens fully populate ThemeTokens shape', () => {
    const keys: (keyof ThemeTokens)[] = [
      'appBg',
      'panelBg',
      'panelMuted',
      'sidebarBg',
      'tabbarBg',
      'inputBg',
      'codeBg',
      'hoverBg',
      'selectedBg',
      'border',
      'borderStrong',
      'borderHair',
      'text',
      'textMed',
      'textLow',
      'textDisabled',
      'diffAddBg',
      'diffAddText',
      'diffDelBg',
      'diffDelText',
      'success',
      'warning',
      'error',
      'info',
      'cardShadow',
      'popoverShadow',
      'modalShadow',
      'scrim',
    ];
    for (const k of keys) {
      expect(THEME_LIGHT[k]).toBeTruthy();
      expect(THEME_DARK[k]).toBeTruthy();
    }
  });
});
