/**
 * UI 文字列の ja / en 辞書。単一 HTML 配布を保つため、別ページにせず同じファイル内で切り替える。
 * 初期言語は navigator.language (ja* なら日本語、それ以外は英語)。URL の ?lang= が優先。
 */
export type Lang = 'ja' | 'en';

export const LANGS: readonly Lang[] = ['ja', 'en'];

export function detectLang(): Lang {
  const nav = typeof navigator === 'undefined' ? '' : navigator.language;
  return nav.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function isLang(v: string | null): v is Lang {
  return v === 'ja' || v === 'en';
}

type Dict = Record<string, string>;

const JA: Dict = {
  title: 'イコールアース図法ビューア',
  'map.aria': '選択した図法で描いた世界地図',
  'panel.lon.aria': '中央経線の操作',
  'lon.label': '中央経線',
  'lon.number.aria': '中央経線(度)',
  'readout.center': '中央',
  'lat.label': '中心緯度',
  'lat.number.aria': '中心緯度(度)',
  'lat.equator': '0°(赤道)',
  'lat.north': '北緯 {n}°',
  'lat.south': '南緯 {n}°',
  'drag.hint.oblique': '地図をドラッグ (スワイプ) して中心を上下左右に動かせます。',
  'readout.seam': '裂け目',
  'preset.americas': 'アメリカ中心 西経90°',
  'preset.pacific': '太平洋中心 東経150°',
  'preset.europe': 'ヨーロッパ・アフリカ中心 0°',
  'spin.start': '回す',
  'spin.stop': '停止',
  'drag.hint': '地図を左右にドラッグ (スワイプ) しても回せます。',
  'panel.view.aria': '表示の設定',
  'proj.label': '図法',
  'toggle.graticule': '経緯線',
  'toggle.tissot': 'ティソーの指示楕円',
  'toggle.countries': '国境 (触ると国名)',
  'toggle.south': '南を上に',
  'export.svg': 'SVG を保存',
  'export.png': 'PNG を保存 (2x)',
  'footer.tissot':
    'ティソーの指示楕円は半径約 500 km の円を 30° 間隔に並べたものです。どの図法も正積なので<strong>どの円も面積が等しく</strong>、形の崩れだけが歪みとして現れます。',
  'footer.src':
    '図法: イコールアース = Šavrič, Patterson &amp; Jenny, <em>Int. J. Geogr. Inf. Sci.</em> 33, 454 (2019; 2018 年公開) ／ 描画: d3-geo ／ 海岸線: Natural Earth (world-atlas 110m)',
  'lang.switch': 'English',
  'lang.switch.aria': '英語に切り替え',
  'family.pseudocylindrical': '擬円筒',
  'family.cylindrical': '円筒',
  'family.lenticular': '楕円外周',
  'family.pseudoconic': '擬円錐',
  'family.azimuthal': '方位',
  'pole.point': '極は点',
  'pole.line': '極は線',
  'lon.prime': '0°(本初子午線)',
  'lon.antimeridian': '180°(日付変更線付近)',
  'lon.east': '東経 {n}°',
  'lon.west': '西経 {n}°',
};

const EN: Dict = {
  title: 'Equal Earth Projection Viewer',
  'map.aria': 'World map drawn in the selected projection',
  'panel.lon.aria': 'Central meridian controls',
  'lon.label': 'Central meridian',
  'lon.number.aria': 'Central meridian (degrees)',
  'readout.center': 'Center',
  'lat.label': 'Center latitude',
  'lat.number.aria': 'Center latitude (degrees)',
  'lat.equator': '0° (equator)',
  'lat.north': '{n}°N',
  'lat.south': '{n}°S',
  'drag.hint.oblique': 'Drag (swipe) the map to move the center in any direction.',
  'readout.seam': 'Seam',
  'preset.americas': 'Americas 90°W',
  'preset.pacific': 'Pacific 150°E',
  'preset.europe': 'Europe & Africa 0°',
  'spin.start': 'Spin',
  'spin.stop': 'Stop',
  'drag.hint': 'You can also drag (swipe) the map sideways.',
  'panel.view.aria': 'Display settings',
  'proj.label': 'Projection',
  'toggle.graticule': 'Graticule',
  'toggle.tissot': "Tissot's indicatrix",
  'toggle.countries': 'Borders (hover for names)',
  'toggle.south': 'South up',
  'export.svg': 'Save SVG',
  'export.png': 'Save PNG (2x)',
  'footer.tissot':
    "Tissot's indicatrices are circles of about 500 km radius placed every 30°. All projections here are equal-area, so <strong>every circle has the same area</strong>; only the shape distortion shows.",
  'footer.src':
    'Projection: Šavrič, Patterson &amp; Jenny, <em>Int. J. Geogr. Inf. Sci.</em> 33, 454 (2019; online 2018) / Rendering: d3-geo / Coastlines: Natural Earth (world-atlas 110m)',
  'lang.switch': '日本語',
  'lang.switch.aria': 'Switch to Japanese',
  'family.pseudocylindrical': 'Pseudocylindrical',
  'family.cylindrical': 'Cylindrical',
  'family.lenticular': 'Lenticular',
  'family.pseudoconic': 'Pseudoconic',
  'family.azimuthal': 'Azimuthal',
  'pole.point': 'Pole is a point',
  'pole.line': 'Pole is a line',
  'lon.prime': '0° (prime meridian)',
  'lon.antimeridian': '180° (near the date line)',
  'lon.east': '{n}°E',
  'lon.west': '{n}°W',
};

const DICTS: Record<Lang, Dict> = { ja: JA, en: EN };

export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const raw = DICTS[lang][key] ?? DICTS.ja[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/**
 * data-i18n 属性を持つ要素に辞書の文字列を流し込む。
 *   data-i18n="key"        → textContent
 *   data-i18n-html="key"   → innerHTML (辞書側の <strong>/<em> だけ、外部入力は入らない)
 *   data-i18n-aria="key"   → aria-label
 */
export function applyLang(lang: Lang): void {
  document.documentElement.lang = lang;
  document.title = t(lang, 'title');
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(lang, el.dataset['i18n'] ?? '');
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-html]')) {
    el.innerHTML = t(lang, el.dataset['i18nHtml'] ?? '');
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(lang, el.dataset['i18nAria'] ?? ''));
  }
}
