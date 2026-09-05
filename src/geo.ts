import { t, type Lang } from './i18n';
import { geoArea, geoCircle, geoGraticule, type GeoSphere } from 'd3-geo';
import { feature, merge, mesh } from 'topojson-client';
import type { Feature, Geometry, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { MultiPolygon as TopoMultiPolygon, Polygon as TopoPolygon } from 'topojson-specification';
import countries50 from 'world-atlas/countries-50m.json';
import countries110 from 'world-atlas/countries-110m.json';
import countryNames from './data/country-names.json';

/** 地図の外郭 (投影された地球全体の輪郭)。 */
export const SPHERE: GeoSphere = { type: 'Sphere' };

export interface CountryProps {
  key: string;
  /** 球面上の面積 (ステラジアン)。正積図法なら投影後の面積 = area × scale² なので毎フレーム測り直さない */
  area: number;
  /** 国名ラベルの置き場所 [経度, 緯度] (Natural Earth の LABEL_X / LABEL_Y) */
  label: [number, number];
}

export interface CountryFeature extends Feature<Geometry, CountryProps> {}

export interface Dataset {
  countries: CountryFeature[];
  /** 陸塊 = 全単位の結合 (陸データを別に持たない) */
  land: MultiPolygon;
  /** 国境線 = 2 単位が接する弧だけ (海岸線は含めない) */
  borders: MultiLineString;
}

const NAMES = countryNames as Record<string, { en: string; ja: string; c: number; x: number; y: number }>;

/** 国の識別 key = world-atlas の name (= NE の NAME)。110m / 50m とも一意で、名前表もこれで引く。 */
function countryKey(name: string): string {
  return name;
}

type CountriesTopo = typeof countries50;

function buildDataset(topo: CountriesTopo): Dataset {
  const geoms = topo.objects.countries;
  return {
    countries: feature(topo, geoms).features.map((f) => {
      const key = countryKey(f.properties.name);
      const n = NAMES[key];
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: { key, area: geoArea(f), label: n ? [n.x, n.y] : [0, 0] },
      };
    }),
    land: merge(topo, geoms.geometries as Array<TopoPolygon | TopoMultiPolygon>),
    borders: mesh(topo, geoms, (a, b) => a !== b),
  };
}

/**
 * 2 段階の詳細度 (Natural Earth 50m / 110m、world-atlas 同梱)。
 * 止まっている時と書き出しは 50m (241 単位、寄れる)、ドラッグ / 回転中は 110m (177 単位、軽い)。
 * 50m だけだと 1 フレーム 170 ms で回せなかった (2026-09-05 実測)。
 */
export const HIGH: Dataset = buildDataset(countries50);
export const LOW: Dataset = buildDataset(countries110 as unknown as CountriesTopo);

/** 国名ラベルと hover は常に 50m の単位で扱う。 */
export const COUNTRIES: CountryFeature[] = HIGH.countries;

/** 国の地図色番号 1〜9 (Natural Earth MAPCOLOR9 = 隣接国が同色にならない配色)。南極は 0 で別扱い。 */
export function countryColorIndex(key: string): number {
  if (key === 'Antarctica') return 0;
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
