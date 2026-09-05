import { geoEqualEarth, type GeoProjection } from 'd3-geo';
import {
  geoRobinson,
  geoMollweide,
  geoEckert4,
  geoCylindricalEqualArea,
} from 'd3-geo-projection';

export interface ProjectionDef {
  id: string;
  label: string;
  /** 素の投影を作る。中央経線・拡大率は map.ts 側が設定する。 */
  create: () => GeoProjection;
  /** 面積を正しく保つか */
  equalArea: boolean;
  /** 極が線として描かれるか (点なら false) */
  poleLine: boolean;
  note: string;
}

export const PROJECTIONS: readonly ProjectionDef[] = [
  {
    id: 'equal-earth',
    label: 'Equal Earth',
    create: () => geoEqualEarth(),
    equalArea: true,
    poleLine: false,
    note: 'Robinson の見た目の自然さを狙いつつ、面積を厳密に保つ (Šavrič–Patterson–Jenny 2018)。',
  },
  {
    id: 'robinson',
    label: 'Robinson',
    create: () => geoRobinson(),
    equalArea: false,
    poleLine: true,
    note: '面積も角度も正しくない折衷図法。破綻の少ない見た目のため長く世界地図に使われた。',
  },
  {
    id: 'mollweide',
    label: 'Mollweide',
    create: () => geoMollweide(),
    equalArea: true,
    poleLine: false,
    note: '正積。外周が楕円で、極付近の形の歪みが大きい。',
  },
  {
    id: 'eckert4',
    label: 'Eckert IV',
    create: () => geoEckert4(),
    equalArea: true,
    poleLine: true,
    note: '正積。極を赤道の半分の長さの線にして、高緯度の潰れを緩める。',
  },
  {
    id: 'gall-peters',
    label: 'Gall-Peters',
    create: () => geoCylindricalEqualArea().parallel(45),
    equalArea: true,
    poleLine: true,
    note: '標準緯線 45° の円筒正積図法。面積は正しいが高緯度の形が極端に縦長になる。',
  },
];

export function findProjection(id: string): ProjectionDef {
  return PROJECTIONS.find((p) => p.id === id) ?? PROJECTIONS[0]!;
}

/** 図法のメタ情報を 1 行で。 */
export function describeProjection(def: ProjectionDef): string {
  const area = def.equalArea ? '正積(面積が正しい)' : '非正積(面積が歪む)';
  const pole = def.poleLine ? '極は線' : '極は点';
  return `${area}・${pole} — ${def.note}`;
}
