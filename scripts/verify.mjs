/**
 * 投影ロジックの回帰テスト (DOM 不要 — d3-geo の計算だけを検証する)。
 *
 *   node scripts/verify.mjs
 *
 * 検証するのは主に 2 つ:
 *   A. map.ts の最適化の前提 — 中央経線を変えても球の外郭 bounds は動かない。
 *      これが崩れると拡大率と高さのキャッシュが不正になる。
 *   B. 受け入れ条件 — 150°E でグリーンランドが左右の縁に分断される / -90 でアメリカ中心 (= 既定値)。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { geoArea, geoAzimuthalEqualArea, geoCircle, geoEqualEarth, geoPath } from 'd3-geo';
import {
  geoBoggs,
  geoBonne,
  geoCylindricalEqualArea,
  geoEckert4,
  geoEckert6,
  geoHammer,
  geoInterruptedHomolosine,
  geoMollweide,
  geoSinusoidal,
  geoWagner4,
  geoWagner7,
} from 'd3-geo-projection';
import { feature } from 'topojson-client';

const here = dirname(fileURLToPath(import.meta.url));
const landTopo = JSON.parse(
  readFileSync(join(here, '..', 'node_modules', 'world-atlas', 'land-110m.json'), 'utf8'),
);
const LAND = feature(landTopo, landTopo.objects.land);

const WIDTH = 960;
const SPHERE = { type: 'Sphere' };

// src/projections.ts の鏡 (id, factory, 極は線か)。追加したら両方に書く。
const PROJECTIONS = [
  ['equal-earth', () => geoEqualEarth(), true],
  ['mollweide', () => geoMollweide(), false],
  ['sinusoidal', () => geoSinusoidal(), false],
  ['goode', () => geoInterruptedHomolosine(), false],
  ['eckert4', () => geoEckert4(), true],
  ['eckert6', () => geoEckert6(), true],
  ['wagner4', () => geoWagner4(), true],
  ['boggs', () => geoBoggs(), false],
  ['lambert-cea', () => geoCylindricalEqualArea().parallel(0), true],
  ['behrmann', () => geoCylindricalEqualArea().parallel(30), true],
  ['gall-peters', () => geoCylindricalEqualArea().parallel(45), true],
  ['hammer', () => geoHammer(), false],
  ['wagner7', () => geoWagner7(), true],
  ['bonne', () => geoBonne(), false],
  ['lambert-azimuthal', () => geoAzimuthalEqualArea(), false],
];

let failures = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

function fitted(create) {
  const projection = create();
  projection.rotate([0, 0, 0]);
  projection.fitWidth(WIDTH, SPHERE);
  const path = geoPath(projection);
  const [[, y0]] = path.bounds(SPHERE);
  const [tx, ty] = projection.translate();
  projection.translate([tx, ty - y0]);
  return { projection, path };
}

console.log('\nA. 経度回転に対する外郭 bounds の不変性 (map.ts のキャッシュ前提)');
for (const [id, create] of PROJECTIONS) {
  const { projection, path } = fitted(create);
  const base = path.bounds(SPHERE).flat();
  let drift = 0;
  for (let lon = -180; lon <= 180; lon += 5) {
    projection.rotate([-lon, 0, 0]);
    const b = path.bounds(SPHERE).flat();
    for (let i = 0; i < 4; i += 1) drift = Math.max(drift, Math.abs(b[i] - base[i]));
  }
  check(drift < 0.5, `${id}: bounds drift ${drift.toFixed(4)} px`, `幅 ${WIDTH}px に対して`);
}

console.log('\nB. 受け入れ条件: 中央経線 150°E でグリーンランドが左右の縁に分断される');
{
  const { projection } = fitted(() => geoEqualEarth());
  projection.rotate([-150, 0, 0]);
  // 裂け目は 150-180 = -30°。グリーンランドはこれをまたぐ (経度 -73〜-12)。
  const east = projection([-12, 72]); // 裂け目の東側 → 地図の左端付近に出るはず
  const west = projection([-45, 72]); // 裂け目の西側 → 地図の右端付近に出るはず
  check(east !== null && west !== null, 'グリーンランド両端が投影可能');
  check(east[0] < WIDTH * 0.25, `東岸 (-12°) が左端側 x=${east[0].toFixed(1)}`);
  check(west[0] > WIDTH * 0.75, `西岸 (-45°) が右端側 x=${west[0].toFixed(1)}`);
  check(west[0] - east[0] > WIDTH * 0.5, '両者が地図をまたいで離れている = 分断されている');
}

console.log('\nB2. 切断面が外郭に収まる (自前分割をしていないことの裏取り)');
for (const [id, create] of PROJECTIONS) {
  const { projection, path } = fitted(create);
  projection.rotate([-150, 0, 0]);
  const [[bx0, by0], [bx1, by1]] = path.bounds(SPHERE);
  const [[lx0, ly0], [lx1, ly1]] = path.bounds(LAND);
  const inside =
    lx0 >= bx0 - 1 && ly0 >= by0 - 1 && lx1 <= bx1 + 1 && ly1 <= by1 + 1;
  check(inside, `${id}: 陸地が外郭内に収まる`, `land x[${lx0.toFixed(0)},${lx1.toFixed(0)}]`);
}

console.log('\nC. 受け入れ条件: lon=-90 (既定値) でアメリカ中心');
{
  const { projection } = fitted(() => geoEqualEarth());
  projection.rotate([90, 0, 0]); // rotate([-lon,0,0]), lon=-90
  const center = projection([-90, 0]);
  check(Math.abs(center[0] - WIDTH / 2) < 1, `経度 -90° が地図中央 x=${center[0].toFixed(1)}`);

  const ny = projection([-74, 40]);
  check(Math.abs(ny[0] - WIDTH / 2) < WIDTH * 0.1, `ニューヨークが中央付近 x=${ny[0].toFixed(1)}`);

  // 中央 -90° の裏側 = 経度 90°E が裂け目。東京 (139°E) は裂け目の東側にあるので
  // 地図は左端から「90°E → 東京 → 日付変更線 → アメリカ(中央)」と並ぶ。
  const tokyo = projection([139, 35]);
  check(tokyo[0] < WIDTH * 0.3, `東京は裂け目 90°E の東 = 左端寄り x=${tokyo[0].toFixed(1)}`);

  // λ' = λ + 90 なので 89.9°E は右端 (λ'=179.9)、90.1°E は左端 (λ'=-179.9) に出る。
  const justWest = projection([89.9, 0]);
  const justEast = projection([90.1, 0]);
  check(
    justWest[0] > WIDTH * 0.9 && justEast[0] < WIDTH * 0.1,
    '経度 90° をまたぐと左右の縁に分かれる = そこが裂け目',
    `x=${justWest[0].toFixed(1)} → ${justEast[0].toFixed(1)}`,
  );
}

console.log('\nE. projections.ts の極の扱い (poleLine) と実測が一致する');
for (const [id, make, expectLine] of PROJECTIONS) {
  const p = make().rotate([0, 0, 0]).translate([0, 0]).scale(1);
  // 極のすぐそばと赤道で、経度方向の局所スケールを比べる (断裂図法でも 1 lobe 内に収まる小さい幅で測る)
  const d = 0.5;
  const sx = (lat) => p([d, lat])[0] - p([-d, lat])[0];
  const ratio = sx(89.99) / sx(0);
  const isLine = ratio > 0.05;
  check(isLine === expectLine, `${id}: 極は${expectLine ? '線' : '点'}`, `極付近/赤道 の経度方向スケール比 = ${ratio.toFixed(3)}`);
}

console.log('\nF. 全図法が正積である (ティソー円の投影面積 / 球面面積 が場所によらず一定)');
for (const [id, make] of PROJECTIONS) {
  const { path } = fitted(make);
  const circle = geoCircle().radius(4.5).precision(0.5);
  // 断裂 (グード) と外周 (ボンヌ・方位) を避けた中心を選ぶ
  const centers = [[0, 0], [0, 60], [60, -30], [150, -45], [-120, 50], [30, 30], [-60, -30]];
  const ratios = centers.map((c) => {
    const g = circle.center(c)();
    return path.area(g) / geoArea(g);
  });
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const spread = Math.max(...ratios.map((r) => Math.abs(r / mean - 1)));
  check(spread < 0.01, `${id}: 面積比のばらつき ${(spread * 100).toFixed(3)}%`, '許容 1%');
}

console.log('\nD. 全図法で陸地・外郭の path が生成できる');
for (const [id, create] of PROJECTIONS) {
  const { projection, path } = fitted(create);
  projection.rotate([-150, 0, 0]);
  const land = path(LAND);
  const sphere = path(SPHERE);
  const [[, y0], [, y1]] = path.bounds(SPHERE);
  check(
    typeof land === 'string' && land.length > 1000 && typeof sphere === 'string',
    `${id}: path 生成`,
    `高さ ${Math.ceil(y1 - y0)}px / land ${land ? land.length : 0} 文字`,
  );
}

console.log(`\n${failures === 0 ? '✅ 全項目 pass' : `❌ ${failures} 件 FAIL`}\n`);
process.exit(failures === 0 ? 0 : 1);
