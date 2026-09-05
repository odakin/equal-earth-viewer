import { geoAzimuthalEqualArea, geoEqualEarth, type GeoProjection } from 'd3-geo';
import { t, type Lang } from './i18n';
import {
  geoBoggs,
  geoBonne,
  geoCylindricalEqualArea,
  geoEckert4,
  geoEckert6,
  geoHammer,
  geoMollweide,
  geoSinusoidal,
  geoWagner4,
  geoWagner7,
} from 'd3-geo-projection';

/** 図法の族。select の optgroup 見出しに使う (i18n key = `family.<id>`)。 */
export type Family = 'pseudocylindrical' | 'cylindrical' | 'lenticular' | 'pseudoconic' | 'azimuthal';

export interface ProjectionDef {
  id: string;
  label: Record<Lang, string>;
  family: Family;
  /** 素の投影を作る。中央経線・拡大率は map.ts 側が設定する。 */
  create: () => GeoProjection;
  /** 極が線として描かれるか (点なら false)。scripts/verify.mjs 項目 E が実測で守る */
  poleLine: boolean;
  note: Record<Lang, string>;
}

/**
 * すべて正積 (面積を正しく保つ) 図法。非正積は入れない (DESIGN.md)。
 * 正積であること自体も scripts/verify.mjs 項目 F がティソー円の面積比で実測する。
 * 順序 = 族ごと、族内はおおむね有名な順。
 */
export const PROJECTIONS: readonly ProjectionDef[] = [
  // ---- 擬円筒 ----
  {
    id: 'equal-earth',
    label: { ja: 'イコールアース', en: 'Equal Earth' },
    family: 'pseudocylindrical',
    create: () => geoEqualEarth(),
    poleLine: true,
    note: {
      ja: 'エケルト第4を土台に見た目の自然さと厳密な正積を両立させた 2018 年の図法 (出典は脚注)。極は赤道の約 6 割の長さ。',
      en: 'A 2018 projection built on Eckert IV, combining a natural look with exact equal-area (Šavrič–Patterson–Jenny). Pole lines are about 0.6 of the equator.',
    },
  },
  {
    id: 'mollweide',
    label: { ja: 'モルワイデ', en: 'Mollweide' },
    family: 'pseudocylindrical',
    create: () => geoMollweide(),
    poleLine: false,
    note: {
      ja: '1805 年。外周が縦横 1:2 の楕円。極付近の形の歪みが大きい。',
      en: '1805. Elliptical outline with a 1:2 aspect. Strong shape distortion near the poles.',
    },
  },
  {
    id: 'sinusoidal',
    label: { ja: 'サンソン', en: 'Sinusoidal' },
    family: 'pseudocylindrical',
    create: () => geoSinusoidal(),
    poleLine: false,
    note: {
      ja: '16 世紀から。緯線は等間隔の直線、経線は正弦曲線。中央経線と赤道の上では長さも正しい。',
      en: 'In use since the 16th century. Straight equally spaced parallels, sinusoidal meridians. Distances are true along the equator and the central meridian.',
    },
  },
  {
    id: 'eckert4',
    label: { ja: 'エケルト第4', en: 'Eckert IV' },
    family: 'pseudocylindrical',
    create: () => geoEckert4(),
    poleLine: true,
    note: {
      ja: '1906 年。極を赤道の半分の長さの線にして、高緯度の潰れを緩める。経線は楕円弧。',
      en: '1906. Poles are lines half the equator length, easing the high-latitude squash. Meridians are elliptical arcs.',
    },
  },
  {
    id: 'eckert6',
    label: { ja: 'エケルト第6', en: 'Eckert VI' },
    family: 'pseudocylindrical',
    create: () => geoEckert6(),
    poleLine: true,
    note: {
      ja: '1906 年。第4 と同じ極線だが経線が正弦曲線。エケルトの 6 図法のうち正積は第2・4・6。',
      en: '1906. Same pole lines as Eckert IV but with sinusoidal meridians. Of Eckert’s six, II, IV and VI are equal-area.',
    },
  },
  {
    id: 'wagner4',
    label: { ja: 'ワグナー第4', en: 'Wagner IV' },
    family: 'pseudocylindrical',
    create: () => geoWagner4(),
    poleLine: true,
    note: {
      ja: '1932 年。極線は赤道の半分、経線は楕円弧の一部。モルワイデの極を切り開いた形。',
      en: '1932. Pole lines half the equator, meridians are portions of ellipses. Like a Mollweide with the poles opened up.',
    },
  },
  {
    id: 'boggs',
    label: { ja: 'ボッグス', en: 'Boggs eumorphic' },
    family: 'pseudocylindrical',
    create: () => geoBoggs(),
    poleLine: false,
    note: {
      ja: '1929 年。サンソンとモルワイデの縦座標を平均して作った図法。',
      en: '1929. Built by averaging the vertical coordinates of the sinusoidal and Mollweide projections.',
    },
  },
  // ---- 円筒 ----
  {
    id: 'lambert-cea',
    label: { ja: 'ランベルト正積円筒', en: 'Lambert cylindrical equal-area' },
    family: 'cylindrical',
    create: () => geoCylindricalEqualArea().parallel(0),
    poleLine: true,
    note: {
      ja: '1772 年。標準緯線 0° の円筒正積図法。縦横 1:π で、高緯度が極端に横に潰れる。',
      en: '1772. Cylindrical equal-area with the standard parallel at the equator. Aspect 1:π; high latitudes are squashed flat.',
    },
  },
  {
    id: 'behrmann',
    label: { ja: 'ベールマン', en: 'Behrmann' },
    family: 'cylindrical',
    create: () => geoCylindricalEqualArea().parallel(30),
    poleLine: true,
    note: {
      ja: '1910 年。標準緯線 30° の円筒正積図法。ランベルトとゴール・ピーターズの中間。',
      en: '1910. Cylindrical equal-area with standard parallels at 30°, between Lambert and Gall–Peters.',
    },
  },
  {
    id: 'gall-peters',
    label: { ja: 'ゴール・ピーターズ', en: 'Gall–Peters' },
    family: 'cylindrical',
    create: () => geoCylindricalEqualArea().parallel(45),
    poleLine: true,
    note: {
      ja: '1855 年 (ゴール)。標準緯線 45° の円筒正積図法。低緯度は縦長に、高緯度は横に潰れて、形の歪みが極端。',
      en: '1855 (Gall). Cylindrical equal-area with standard parallels at 45°. Low latitudes are stretched tall, high latitudes squashed flat.',
    },
  },
  // ---- 楕円外周 (改良方位) ----
  {
    id: 'hammer',
    label: { ja: 'ハンマー', en: 'Hammer' },
    family: 'lenticular',
    create: () => geoHammer(),
    poleLine: false,
    note: {
      ja: '1892 年。外周は 1:2 の楕円でモルワイデに似るが、緯線も曲がるので極付近の歪みが軽い。天文学の全天図で定番。',
      en: '1892. Same 1:2 elliptical outline as Mollweide, but curved parallels reduce distortion near the poles. Standard for all-sky maps in astronomy.',
    },
  },
  {
    id: 'wagner7',
    label: { ja: 'ワグナー第7', en: 'Wagner VII' },
    family: 'lenticular',
    create: () => geoWagner7(),
    poleLine: true,
    note: {
      ja: '1941 年。ハンマーの極を線に切り開いた形。地図帳の世界図に使われる。',
      en: '1941. A Hammer with the poles opened into lines. Used for world maps in atlases.',
    },
  },
  // ---- 擬円錐 ----
  {
    id: 'bonne',
    label: { ja: 'ボンヌ', en: 'Bonne' },
    family: 'pseudoconic',
    create: () => geoBonne(),
    poleLine: false,
    note: {
      ja: '18 世紀 (標準緯線 45°N)。緯線は同心円弧で、中央経線の上と各緯線の上で長さが正しい。世界全体を描くとハート形になる。',
      en: '18th century (standard parallel 45°N). Concentric circular parallels; distances are true along the central meridian and every parallel. The whole world comes out heart-shaped.',
    },
  },
  // ---- 方位 ----
  {
    id: 'lambert-azimuthal',
    label: { ja: 'ランベルト正積方位', en: 'Lambert azimuthal equal-area' },
    family: 'azimuthal',
    create: () => geoAzimuthalEqualArea(),
    poleLine: false,
    note: {
      ja: '1772 年。中心からの方位が正しい。全球を 1 枚の円に収めると、中心の対蹠点が外周の円に引き伸ばされる。',
      en: '1772. Directions from the center are true. Mapping the whole globe into one disc stretches the antipode of the center into the outer circle.',
    },
  },
];

export const FAMILIES: readonly Family[] = [
  'pseudocylindrical',
  'cylindrical',
  'lenticular',
  'pseudoconic',
  'azimuthal',
];

export function findProjection(id: string): ProjectionDef {
  return PROJECTIONS.find((p) => p.id === id) ?? PROJECTIONS[0]!;
}

/** 図法のメタ情報を 1 行で。 */
export function describeProjection(def: ProjectionDef, lang: Lang): string {
  const pole = t(lang, def.poleLine ? 'pole.line' : 'pole.point');
  return `${pole} — ${def.note[lang]}`;
}
