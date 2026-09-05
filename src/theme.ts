/**
 * 地図の配色。
 *
 * UI の配色は style.css の CSS 変数が持つが、地図 (SVG) の色はここが単一の正本。
 * 理由: SVG を PNG / SVG に書き出すとき外部 CSS は効かないため、色は SVG 内の
 * <style> に焼き込む必要がある。焼き込む値を TS 側に置くことで、画面表示と
 * 書き出しで色が食い違わないことを保証する。
 */
export interface Theme {
  ocean: string;
  land: string;
  landStroke: string;
  graticule: string;
  /** 赤道・中央経線 (太線) */
  major: string;
  outline: string;
  tissotFill: string;
  tissotStroke: string;
}

export const themes = {
  light: {
    ocean: '#fcfcfa',
    land: '#93ab8b',
    landStroke: '#7a9172',
    graticule: '#d8d8d4',
    major: '#9a9a94',
    outline: '#8c8c86',
    tissotFill: 'rgba(191, 97, 63, 0.30)',
    tissotStroke: 'rgba(150, 70, 45, 0.80)',
  },
  dark: {
    ocean: '#15181c',
    land: '#5f7a59',
    landStroke: '#7a9673',
    graticule: '#333a42',
    major: '#5c6672',
    outline: '#6c7683',
    tissotFill: 'rgba(224, 138, 96, 0.28)',
    tissotStroke: 'rgba(235, 160, 120, 0.85)',
  },
} as const satisfies Record<string, Theme>;

export type ThemeName = keyof typeof themes;

/** 画面の現在のテーマ。書き出しでは常に light を使う (印刷・スライド用途)。 */
export function currentTheme(): Theme {
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  return dark ? themes.dark : themes.light;
}
