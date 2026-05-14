import type { Page } from 'playwright';

export interface ThemeProbeSnapshot {
  sidebarBg: string;
  tabbarBg: string;
  statusBarBg: string;
  topChromeBg: string;
}

/** Reads computed background colors at the canonical shell test IDs. */
export async function themeProbe(page: Page): Promise<ThemeProbeSnapshot> {
  return page.evaluate(() => {
    const get = (sel: string): string => {
      const el = document.querySelector(sel);
      if (!el) return '';
      return window.getComputedStyle(el).backgroundColor;
    };
    return {
      sidebarBg: get('[data-testid="sidebar"]'),
      tabbarBg: get('[data-testid="tab-bar"]'),
      statusBarBg: get('[data-testid="status-bar"]'),
      topChromeBg: get('[data-testid="top-chrome"]'),
    };
  });
}

/** Set a setting via the renderer-exposed API. */
export async function setTweak<K extends string>(page: Page, key: K, value: unknown): Promise<void> {
  await page.evaluate(
    ({ k, v }) => {
      const w = window as unknown as {
        jide: { settings: { set: (k: string, v: unknown) => Promise<void> } };
      };
      return w.jide.settings.set(k, v);
    },
    { k: key, v: value },
  );
}

export function rgbToHex(color: string): string {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return color;
  return (
    '#' +
    [m[1], m[2], m[3]]
      .map((x) => Number(x).toString(16).padStart(2, '0').toUpperCase())
      .join('')
  );
}
