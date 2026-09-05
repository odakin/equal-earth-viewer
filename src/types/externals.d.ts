// d3-geo-projection は型定義を同梱しておらず、DefinitelyTyped にも
// @types/d3-geo-projection が存在しない (2026-09 時点で確認)。
// このアプリが実際に使う図法ぶんだけを最小限で宣言する。
declare module 'd3-geo-projection' {
  import type { GeoProjection } from 'd3-geo';

  export function geoMollweide(): GeoProjection;
  export function geoEckert4(): GeoProjection;
  export function geoSinusoidal(): GeoProjection;
  export function geoHammer(): GeoProjection;
  export function geoWagner7(): GeoProjection;
  export function geoBonne(): GeoProjection;

  /** 標準緯線を持つ円筒正積図法 (parallel 45° で Gall-Peters になる)。 */
  export interface GeoCylindricalEqualAreaProjection extends GeoProjection {
    parallel(): number;
    parallel(angle: number): this;
  }
  export function geoCylindricalEqualArea(): GeoCylindricalEqualAreaProjection;
}

// world-atlas の TopoJSON。中身を tsc に型推論させると無駄に重いので Topology として受ける。
declare module 'world-atlas/countries-110m.json' {
  import type { Topology, GeometryCollection } from 'topojson-specification';
  const topology: Topology<{ countries: GeometryCollection<{ name: string }> }>;
  export default topology;
}
