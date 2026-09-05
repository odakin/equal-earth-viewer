import { geoEqualEarth, type GeoProjection } from 'd3-geo';
import {
  geoMollweide,
  geoEckert4,
  geoCylindricalEqualArea,
} from 'd3-geo-projection';

export interface ProjectionDef {
  id: string;
  label: string;
  /** 素の投影を作る。中央経線・拡大率は map.ts 側が設定する。 */
  create: () => GeoProjection;
  /** 極が線として描かれるか (点なら false) */
  poleLine: boolean;
  note: string;
}

/** すべて正積 (面積を正しく保つ) 図法。非正積は入れない (DESIGN.md)。 */
export const PROJECTIONS: readonly ProjectionDef[] = [
  {
    id: 'equal-earth',
    label: 'Equal Earth',
    create: () => geoEqualEarth(),
    poleLine: false,
    note: '見た目の自然さと厳密な正積を両立させた 2018 年の図法 (Šavrič–Patterson–Jenny)。',
  },
  {
    id: 'mollweide',
    label: 'Mollweide',
    create: () => geoMollweide(),
    poleLine: false,
    note: '外周が楕円。極付近の形の歪みが大きい。',
  },
  {
    id: 'eckert4',
    label: 'Eckert IV',
    create: () => geoEckert4(),
    poleLine: true,
    note: '極を赤道の半分の長さの線にして、高緯度の潰れを緩める。',
  },
  {
    id: 'gall-peters',
    label: 'Gall-Peters',
    create: () => geoCylindricalEqualArea().parallel(45),
    poleLine: true,
    note: '標準緯線 45° の円筒図法。高緯度の形が極端に縦長になる。',
  },
];

export function findProjection(id: string): ProjectionDef {
  return PROJECTIONS.find((p) => p.id === id) ?? PROJECTIONS[0]!;
}

/** 図法のメタ情報を 1 行で。 */
export function describeProjection(def: ProjectionDef): string {
  const pole = def.poleLine ? '極は線' : '極は点';
  return `${pole} — ${def.note}`;
}
