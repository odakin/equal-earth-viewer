import { geoPath, type GeoProjection } from 'd3-geo';
import { BORDERS, COUNTRIES, GRATICULE, LAND, SPHERE, countryColorIndex, countryName, tissotCircles } from './geo';
import { findProjection, type ProjectionDef } from './projections';
import type { AppState } from './state';
import type { Theme } from './theme';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 地図の描画幅 (SVG 座標)。実表示は viewBox で伸縮するので画面幅とは独立。 */
export const MAP_WIDTH = 960;

/** ティソー円の中心は固定なので、GeoJSON は 1 度だけ作れば足りる。 */
const TISSOT = tissotCircles();

/** 投影を差し替えて使い回す (仕様: path は再生成しない)。 */
const pathGen = geoPath();

interface Fitted {
  projection: GeoProjection;
  height: number;
}

const fittedCache = new Map<string, Fitted>();

/**
 * 図法ごとに拡大率と原点を 1 度だけ確定する。
 *
 * 擬円筒・円筒図法では中央経線を変えても投影された球の外郭は合同なので、
 * fit を毎フレーム走らせる必要がない。これによりドラッグ操作中の仕事は
 * 「rotate を変えて d を引き直す」だけになる。
 */
function getFitted(def: ProjectionDef): Fitted {
  const cached = fittedCache.get(def.id);
  if (cached) return cached;

  const projection = def.create();
  projection.rotate([0, 0, 0]);
  projection.fitWidth(MAP_WIDTH, SPHERE);

  pathGen.projection(projection);
  const [[, y0], [, y1]] = pathGen.bounds(SPHERE);
  const height = Math.ceil(y1 - y0);

  // 外郭の上端が y=0 に来るよう原点をずらす → viewBox を 0 起点にできる
  const [tx, ty] = projection.translate();
  projection.translate([tx, ty - y0]);

  const fitted: Fitted = { projection, height };
  fittedCache.set(def.id, fitted);
  return fitted;
}

interface MapNodes {
  style: SVGStyleElement;
  ocean: SVGPathElement;
  graticule: SVGPathElement;
  land: SVGPathElement;
  borders: SVGPathElement;
  /** 国名ラベル (国モード)。国と同じ順で text が並ぶ */
  labels: SVGGElement;
  labelsLang: string;
  /** 国ごとの塗り分け (国モード)。画面では hover / tap の当たり判定も兼ねる */
  countries: SVGGElement;
  tissot: SVGGElement;
  outline: SVGPathElement;
}

const nodeCache = new WeakMap<SVGSVGElement, MapNodes>();

function el<K extends keyof SVGElementTagNameMap>(tag: K, cls?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  if (cls !== undefined) node.setAttribute('class', cls);
  return node;
}

/** 初回だけ DOM を組み立て、以降は同じ要素の d 属性を書き換える。 */
function ensureNodes(svg: SVGSVGElement): MapNodes {
  const cached = nodeCache.get(svg);
  if (cached) return cached;

  const nodes: MapNodes = {
    style: el('style'),
    ocean: el('path', 'ocean'),
    graticule: el('path', 'graticule'),
    land: el('path', 'land'),
    borders: el('path', 'border'),
    labels: el('g', 'labels'),
    labelsLang: '',
    countries: el('g', 'countries'),
    tissot: el('g', 'tissot'),
    outline: el('path', 'outline'),
  };
  for (let i = 0; i < TISSOT.length; i += 1) nodes.tissot.appendChild(el('path'));
  for (const c of COUNTRIES) {
    const p = el('path', `c${countryColorIndex(c.properties.key)}`);
    p.dataset['key'] = c.properties.key;
    nodes.countries.appendChild(p);
    nodes.labels.appendChild(el('text'));
  }

  // 重ね順: 海 → 経緯線 → 陸 → 国の塗り分け → 国境 → ティソー → 外郭 → 国名
  // (ティソー・外郭は fill が無いので pointer は下の国 path に届く = hover / tap の当たり判定になる)
  svg.append(
    nodes.style,
    nodes.ocean,
    nodes.graticule,
    nodes.land,
    nodes.countries,
    nodes.borders,
    nodes.tissot,
    nodes.outline,
    nodes.labels,
  );
  nodeCache.set(svg, nodes);
  return nodes;
}

function svgCss(theme: Theme): string {
  return [
    `.ocean{fill:${theme.ocean}}`,
    `.land{fill:${theme.land};stroke:${theme.landStroke};stroke-width:.5}`,
    `.graticule{fill:none;stroke:${theme.graticule};stroke-width:.6}`,
    `.border{fill:none;stroke:${theme.border};stroke-width:.6;stroke-linejoin:round}`,
    `.countries path{stroke:none}`,
    ...theme.countryFills.map((color, i) => `.countries .c${i}{fill:${color}}`),
    `.tissot path{fill:${theme.tissotFill};stroke:${theme.tissotStroke};stroke-width:.7}`,
    `.outline{fill:none;stroke:${theme.outline};stroke-width:1.2}`,
    `.labels text{fill:${theme.label};stroke:${theme.labelHalo};stroke-width:.22em;stroke-linejoin:round;paint-order:stroke;text-anchor:middle;dominant-baseline:central;font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;pointer-events:none}`,
  ].join('');
}

function show(node: SVGElement, visible: boolean): void {
  node.style.display = visible ? '' : 'none';
}

/**
 * state を SVG に描く。画面表示と書き出しで同じ関数を使うので、
 * 見えているものと書き出されるものが食い違わない。
 *
 * @returns 描画高さ (SVG 座標)
 */
export function renderInto(svg: SVGSVGElement, state: AppState, theme: Theme): number {
  const def = findProjection(state.projectionId);
  const { projection, height } = getFitted(def);

  // 中央経線の指定は rotate の第 1 引数のみ。反子午線クリップは d3-geo に任せる。
  // 方位図法だけ第 2 引数 (中心緯度) も使う。他は 0 固定 = fit キャッシュ前提の範囲内。
  // 第 3 引数 180° = 地図全体を 180° 回す (南が上、東が左)。外郭は点対称なので fit キャッシュはそのまま (項目 A3)。
  projection.rotate([-state.lon, def.oblique ? -state.lat : 0, state.southUp ? 180 : 0]);
  pathGen.projection(projection);

  const nodes = ensureNodes(svg);
  svg.setAttribute('viewBox', viewBoxFor(state, height).join(' '));
  nodes.style.textContent = svgCss(theme);

  // 海の塗りと外郭線は同じ形。毎フレーム通る経路なので投影計算は 1 回で済ませる。
  const spherePath = pathGen(SPHERE) ?? '';
  nodes.ocean.setAttribute('d', spherePath);
  nodes.outline.setAttribute('d', spherePath);

  show(nodes.graticule, state.showGraticule);
  if (state.showGraticule) nodes.graticule.setAttribute('d', pathGen(GRATICULE) ?? '');

  nodes.land.setAttribute('d', pathGen(LAND) ?? '');

  show(nodes.borders, state.showCountries);
  if (state.showCountries) nodes.borders.setAttribute('d', pathGen(BORDERS) ?? '');
  show(nodes.countries, state.showCountries);
  if (state.showCountries) {
    const children = nodes.countries.children;
    COUNTRIES.forEach((c, i) => {
      children.item(i)?.setAttribute('d', pathGen(c) ?? '');
    });
  }

  show(nodes.labels, state.showCountries);
  if (state.showCountries) renderLabels(nodes, state, projection, svg);

  show(nodes.tissot, state.showTissot);
  if (state.showTissot) {
    const children = nodes.tissot.children;
    TISSOT.forEach((circle, i) => {
      children.item(i)?.setAttribute('d', pathGen(circle) ?? '');
    });
  }

  return height;
}

/** 国名ラベルの画面上の文字サイズ (px)。拡大しても画面上ではこの大きさのまま */
const LABEL_PX = 9;

/** 文字列の幅を文字サイズの倍数で見積もる (CJK ≒ 1 文字幅、英数 ≒ 0.55) */
function textWidthEm(s: string): number {
  let w = 0;
  for (const ch of s) w += /[\u3000-\u9fff\uf900-\uffef]/.test(ch) ? 1 : 0.55;
  return w;
}

/**
 * 国名ラベル。全国ぶん置くが、「文字が国の幅に収まる」ものだけ表示する。
 * 文字は画面上で一定サイズ (SVG 単位では 1/zoom) なので、寄るほど小さい国の名前が現れる。
 * 国の幅は正積の性質から sqrt(球面面積 × scale²) で見積もる (回転で変わらず、毎フレーム安い)。
 */
function renderLabels(nodes: MapNodes, state: AppState, projection: GeoProjection, svg: SVGSVGElement): void {
  const lang = state.lang;
  const children = nodes.labels.children;
  if (nodes.labelsLang !== lang) {
    COUNTRIES.forEach((c, i) => {
      const t = children.item(i);
      if (t) t.textContent = countryName(c.properties.key, lang);
    });
    nodes.labelsLang = lang;
  }
  // 画面 1 px あたりの SVG 単位 (書き出し時は rect が無いので 1/zoom)
  const rectWidth = svg.isConnected ? svg.getBoundingClientRect().width : 0;
  const svgPerPx = rectWidth > 0 ? MAP_WIDTH / state.zoom / rectWidth : 1 / state.zoom;
  const fontSvg = LABEL_PX * svgPerPx;
  const k = projection.scale();
  COUNTRIES.forEach((c, i) => {
    const t = children.item(i) as SVGTextElement | null;
    if (!t) return;
    const name = t.textContent ?? '';
    const width = textWidthEm(name) * fontSvg;
    const diameter = Math.sqrt(c.properties.area) * k;
    const p = width <= diameter * 0.95 ? projection(c.properties.label) : null;
    if (p === null) {
      t.style.display = 'none';
      return;
    }
    t.style.display = '';
    t.setAttribute('x', p[0].toFixed(1));
    t.setAttribute('y', p[1].toFixed(1));
    t.setAttribute('font-size', fontSvg.toFixed(2));
  });
}

/**
 * 拡大率と縦ずらしから viewBox を決める。横は常に中央 (経度は回転で見る)、縦は panY で
 * ずらすが外郭の外には出ない。zoom=1 なら全体 = `0 0 W H`。
 */
export function viewBoxFor(state: AppState, height: number): [number, number, number, number] {
  const z = Math.max(1, state.zoom);
  const vw = MAP_WIDTH / z;
  const vh = height / z;
  const x = (MAP_WIDTH - vw) / 2;
  const y = Math.max(0, Math.min(height - vh, (height - vh) / 2 + state.panY));
  return [x, y, vw, vh];
}

/** 書き出し用に、単体で成立する SVG 要素を新規に組み立てる。 */
export function buildStandaloneSvg(
  state: AppState,
  theme: Theme,
): { svg: SVGSVGElement; width: number; height: number } {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const height = renderInto(svg, state, theme);
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(MAP_WIDTH));
  svg.setAttribute('height', String(height));
  return { svg, width: MAP_WIDTH, height };
}
