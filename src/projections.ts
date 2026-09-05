import { geoEqualEarth, type GeoProjection } from 'd3-geo';
import { t, type Lang } from './i18n';
import {
  geoMollweide,
  geoEckert4,
  geoCylindricalEqualArea,
} from 'd3-geo-projection';

export interface ProjectionDef {
  id: string;
  label: Record<Lang, string>;
  /** 素の投影を作る。中央経線・拡大率は map.ts 側が設定する。 */
  create: () => GeoProjection;
  /** 極が線として描かれるか (点なら false) */
  poleLine: boolean;
  note: Record<Lang, string>;
}

/** すべて正積 (面積を正しく保つ) 図法。非正積は入れない (DESIGN.md)。 */
export const PROJECTIONS: readonly ProjectionDef[] = [
  {
    id: 'equal-earth',
    label: { ja: 'イコールアース', en: 'Equal Earth' },
    create: () => geoEqualEarth(),
    // 極は赤道の約 0.59 倍の長さの線 (scripts/verify.mjs 項目 E が実測で守る)
    poleLine: true,
    note: {
      ja: 'エケルト第4を土台に見た目の自然さと厳密な正積を両立させた 2018 年の図法 (出典は脚注)。極は赤道の約 6 割の長さ。',
      en: 'A 2018 projection built on Eckert IV, combining a natural look with exact equal-area (Šavrič–Patterson–Jenny). Pole lines are about 0.6 of the equator.',
    },
  },
  {
    id: 'mollweide',
    label: { ja: 'モルワイデ', en: 'Mollweide' },
    create: () => geoMollweide(),
    poleLine: false,
    note: {
      ja: '外周が楕円。極付近の形の歪みが大きい。',
      en: 'Elliptical outline. Strong shape distortion near the poles.',
    },
  },
  {
    id: 'eckert4',
    label: { ja: 'エケルト第4', en: 'Eckert IV' },
    create: () => geoEckert4(),
    poleLine: true,
    note: {
      ja: '極を赤道の半分の長さの線にして、高緯度の潰れを緩める。',
      en: 'Poles are lines half the equator length, easing the high-latitude squash.',
    },
  },
  {
    id: 'gall-peters',
    label: { ja: 'ゴール・ピーターズ', en: 'Gall-Peters' },
    create: () => geoCylindricalEqualArea().parallel(45),
    poleLine: true,
    note: {
      ja: '標準緯線 45° の円筒図法。低緯度は縦長に、高緯度は横に潰れて、形の歪みが極端。',
      en: 'Cylindrical with standard parallels at 45°. Low latitudes are stretched tall, high latitudes squashed flat.',
    },
  },
];

export function findProjection(id: string): ProjectionDef {
  return PROJECTIONS.find((p) => p.id === id) ?? PROJECTIONS[0]!;
}

/** 図法のメタ情報を 1 行で。 */
export function describeProjection(def: ProjectionDef, lang: Lang): string {
  const pole = t(lang, def.poleLine ? 'pole.line' : 'pole.point');
  return `${pole} — ${def.note[lang]}`;
}
