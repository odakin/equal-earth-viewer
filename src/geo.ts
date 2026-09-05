import { t, type Lang } from './i18n';
import { geoGraticule, geoCircle, type GeoSphere } from 'd3-geo';
import { feature, merge, mesh } from 'topojson-client';
import type { Feature, Geometry, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { MultiPolygon as TopoMultiPolygon, Polygon as TopoPolygon } from 'topojson-specification';
import countriesTopo from 'world-atlas/countries-110m.json';
import countryNames from './data/country-names.json';

/** 地図の外郭 (投影された地球全体の輪郭)。 */
export const SPHERE: GeoSphere = { type: 'Sphere' };

/**
 * 国 (Natural Earth 110m、world-atlas 同梱)。陸塊はこれを merge して作る
 * (land-110m と面積が一致することを確認済、二重に持たない)。TopoJSON → GeoJSON は module 評価時の 1 回。
 */
const countryGeoms = countriesTopo.objects.countries;

/** 国の識別 key。ISO 3166-1 numeric、無いもの (コソボ等 3 国) は名前で代用。 */
function countryKey(id: string | number | undefined, name: string): string {
  return id === undefined ? `n:${name}` : String(id);
}

export interface CountryFeature extends Feature<Geometry, { key: string }> {}

export const COUNTRIES: CountryFeature[] = feature(countriesTopo, countryGeoms).features.map((f) => ({
  type: 'Feature',
  geometry: f.geometry,
  properties: { key: countryKey(f.id, f.properties.name) },
}));

/** 陸塊 = 全国の結合。 */
export const LAND: MultiPolygon = merge(
  countriesTopo,
  countryGeoms.geometries as Array<TopoPolygon | TopoMultiPolygon>,
);

/** 国境線 = 2 国が接する弧だけ (海岸線は含めない)。 */
export const BORDERS: MultiLineString = mesh(countriesTopo, countryGeoms, (a, b) => a !== b);

const NAMES = countryNames as Record<string, { en: string; ja: string; c: number }>;

/** 国の地図色番号 1〜7 (Natural Earth MAPCOLOR7 = 隣接国が同色にならない配色)。南極は 0 で別扱い。 */
export function countryColorIndex(key: string): number {
  if (key === '010') return 0; // 南極
  return NAMES[key]?.c ?? 1;
}

/** 国名 (Natural Earth の NAME / NAME_JA)。 */
export function countryName(key: string, lang: Lang): string {
  const n = NAMES[key];
  if (n === undefined) return key;
  return lang === 'ja' ? n.ja : n.en;
}

/** 30° 間隔の経緯線。極まで引くので図法ごとの極の扱い (点 / 線) が見える。 */
export const GRATICULE: MultiLineString = geoGraticule()
  .step([30, 30])
  .extent([
    [-180, -90],
    [180, 90],
  ])();


/**
 * ティソーの指示楕円。半径 4.5° ≒ 500 km の測地円を 30° 格子に置く。
 * 緯度 ±90° は極点で円が重なり潰れるので ±60° までとする。
 */
export function tissotCircles(): Polygon[] {
  const circle = geoCircle().radius(4.5).precision(2);
  const out: Polygon[] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lon = -180; lon < 180; lon += 30) {
      out.push(circle.center([lon, lat])());
    }
  }
  return out;
}

/** 経度を -180 以上 180 未満に畳む (連続回転させるときに使う)。 */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** 緯度の表記 (方位図法の中心緯度)。 */
export function formatLat(lat: number, lang: Lang = 'ja'): string {
  const x = Math.round(Math.max(-90, Math.min(90, lat)));
  if (x === 0) return t(lang, 'lat.equator');
  return x > 0 ? t(lang, 'lat.north', { n: x }) : t(lang, 'lat.south', { n: -x });
}

/** 経度を教材向けの日本語表記に。 */
export function formatLon(lon: number, lang: Lang = 'ja'): string {
  const x = Math.round(wrapLon(lon));
  if (x === 0) return t(lang, 'lon.prime');
  if (x === -180) return t(lang, 'lon.antimeridian');
  return x > 0 ? t(lang, 'lon.east', { n: x }) : t(lang, 'lon.west', { n: -x });
}
