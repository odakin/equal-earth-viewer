import { geoPath, type GeoProjection } from 'd3-geo';
import { BORDERS, COUNTRIES, GRATICULE, LAND, SPHERE, tissotCircles } from './geo';
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
  /** 国名 hover / tap 用の当たり判定 (画面用 SVG だけ、書き出しには入れない) */
  countries: SVGGElement | null;
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
function ensureNodes(svg: SVGSVGElement, interactive: boolean): MapNodes {
  const cached = nodeCache.get(svg);
  if (cached) return cached;

  const nodes: MapNodes = {
    style: el('style'),
    ocean: el('path', 'ocean'),
    graticule: el('path', 'graticule'),
    land: el('path', 'land'),
    borders: el('path', 'border'),
    countries: interactive ? el('g', 'countries') : null,
    tissot: el('g', 'tissot'),
    outline: el('path', 'outline'),
  };
  for (let i = 0; i < TISSOT.length; i += 1) nodes.tissot.appendChild(el('path'));
  if (nodes.countries !== null) {
    for (const c of COUNTRIES) {
      const p = el('path');
      p.dataset['key'] = c.properties.key;
      nodes.countries.appendChild(p);
    }
  }

  // 重ね順: 海 → 経緯線 → 陸 → 国境 → ティソー → 外郭 → (当たり判定)
  svg.append(nodes.style, nodes.ocean, nodes.graticule, nodes.land, nodes.borders, nodes.tissot, nodes.outline);
  if (nodes.countries !== null) svg.append(nodes.countries);
  nodeCache.set(svg, nodes);
  return nodes;
}

function svgCss(theme: Theme): string {
  return [
    `.ocean{fill:${theme.ocean}}`,
    `.land{fill:${theme.land};stroke:${theme.landStroke};stroke-width:.5}`,
    `.graticule{fill:none;stroke:${theme.graticule};stroke-width:.6}`,
    `.border{fill:none;stroke:${theme.border};stroke-width:.6;stroke-linejoin:round}`,
    `.countries path{fill:transparent;stroke:none}`,
    `.tissot path{fill:${theme.tissotFill};stroke:${theme.tissotStroke};stroke-width:.7}`,
    `.outline{fill:none;stroke:${theme.outline};stroke-width:1.2}`,
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
export interface RenderOptions {
  /** 国名 hover / tap の当たり判定 path を持つか (画面用 SVG のみ true、書き出しは false) */
  interactive?: boolean;
  /**
   * 当たり判定 path の d を更新するか。ドラッグ / 回転中 (commit=false) は 177 本の再計算を
   * 飛ばして描画を軽くし、止まった時 (commit=true) にだけ揃える。
   */
  updateHitPaths?: boolean;
}

export function renderInto(
  svg: SVGSVGElement,
  state: AppState,
  theme: Theme,
  { interactive = true, updateHitPaths = true }: RenderOptions = {},
): number {
  const def = findProjection(state.projectionId);
  const { projection, height } = getFitted(def);

  // 中央経線の指定は rotate の第 1 引数のみ。反子午線クリップは d3-geo に任せる。
  // 方位図法だけ第 2 引数 (中心緯度) も使う。他は 0 固定 = fit キャッシュ前提の範囲内。
  // 第 3 引数 180° = 地図全体を 180° 回す (南が上、東が左)。外郭は点対称なので fit キャッシュはそのまま (項目 A3)。
  projection.rotate([-state.lon, def.oblique ? -state.lat : 0, state.southUp ? 180 : 0]);
  pathGen.projection(projection);

  const nodes = ensureNodes(svg, interactive);
  svg.setAttribute('viewBox', `0 0 ${MAP_WIDTH} ${height}`);
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
  if (nodes.countries !== null) {
    show(nodes.countries, state.showCountries);
    if (state.showCountries && updateHitPaths) {
      const children = nodes.countries.children;
      COUNTRIES.forEach((c, i) => {
        children.item(i)?.setAttribute('d', pathGen(c) ?? '');
      });
    }
  }

  show(nodes.tissot, state.showTissot);
  if (state.showTissot) {
    const children = nodes.tissot.children;
    TISSOT.forEach((circle, i) => {
      children.item(i)?.setAttribute('d', pathGen(circle) ?? '');
    });
  }

  return height;
}

/** 書き出し用に、単体で成立する SVG 要素を新規に組み立てる。 */
export function buildStandaloneSvg(
  state: AppState,
  theme: Theme,
): { svg: SVGSVGElement; width: number; height: number } {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const height = renderInto(svg, state, theme, { interactive: false });
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(MAP_WIDTH));
  svg.setAttribute('height', String(height));
  return { svg, width: MAP_WIDTH, height };
}
