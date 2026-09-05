import { buildStandaloneSvg } from './map';
import { findProjection } from './projections';
import type { AppState } from './state';
import { themes } from './theme';

/** 書き出しは常に light テーマ (スライド・配布資料に貼る前提)。 */
const EXPORT_THEME = themes.light;

function baseName(state: AppState): string {
  const lon = Math.round(state.lon);
  const label = lon === 0 ? '0' : `${Math.abs(lon)}${lon > 0 ? 'E' : 'W'}`;
  return `${findProjection(state.projectionId).id}_lon${label}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function serialize(state: AppState): { markup: string; width: number; height: number } {
  const { svg, width, height } = buildStandaloneSvg(state, EXPORT_THEME);
  return { markup: new XMLSerializer().serializeToString(svg), width, height };
}

export function downloadSvg(state: AppState): void {
  const { markup } = serialize(state);
  triggerDownload(
    new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }),
    `${baseName(state)}.svg`,
  );
}

/** PNG は 2 倍解像度。SVG は外部参照を持たないので canvas は汚染されない。 */
export function downloadPng(state: AppState, scale = 2): Promise<void> {
  const { markup, width, height } = serialize(state);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas 2d context を取得できませんでした'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) triggerDownload(blob, `${baseName(state)}@${scale}x.png`);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('SVG の画像化に失敗しました'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
}
