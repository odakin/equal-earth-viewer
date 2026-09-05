import { geoGraticule, geoCircle, type GeoSphere } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry, LineString, MultiLineString, Polygon } from 'geojson';
import landTopo from 'world-atlas/land-110m.json';

/** 地図の外郭 (投影された地球全体の輪郭)。 */
export const SPHERE: GeoSphere = { type: 'Sphere' };

/**
 * 陸塊。world-atlas の land-110m は国境を含まない陸地そのものなので、
 * countries + topojson.merge と同じ結果がそのまま手に入る (かつ約半分のサイズ)。
 * TopoJSON → GeoJSON の変換は module 評価時の 1 回だけ。
 */
export const LAND = feature(landTopo, landTopo.objects.land) as FeatureCollection<Geometry>;

/** 30° 間隔の経緯線。極まで引くので図法ごとの極の扱い (点 / 線) が見える。 */
export const GRATICULE: MultiLineString = geoGraticule()
  .step([30, 30])
  .extent([
    [-180, -90],
    [180, 90],
  ])();

function sample(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  if (out[out.length - 1] !== to) out.push(to);
  return out;
}

/** 赤道。太線で強調するため graticule とは別に持つ。 */
export const EQUATOR: LineString = {
  type: 'LineString',
  coordinates: sample(-180, 180, 2).map((lon) => [lon, 0]),
};

/** 指定経度の子午線 (中央経線の強調用)。 */
export function meridian(lon: number): LineString {
  return {
    type: 'LineString',
    coordinates: sample(-90, 90, 2).map((lat) => [lon, lat]),
  };
}

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

/** 経度を教材向けの日本語表記に。 */
export function formatLon(lon: number): string {
  const x = Math.round(wrapLon(lon));
  if (x === 0) return '0°(本初子午線)';
  if (x === -180) return '180°(日付変更線付近)';
  return x > 0 ? `東経 ${x}°` : `西経 ${-x}°`;
}
