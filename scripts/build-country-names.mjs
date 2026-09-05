/**
 * src/data/country-names.json を Natural Earth 110m admin_0 (public domain) から生成する。
 *
 *   node scripts/build-country-names.mjs <ne_50m_admin_0_countries.geojson>
 *   (world-atlas の countries-50m.json と対で使う。解像度を変えるなら両方揃える)
 *
 * 出力: { <key>: { en, ja, c, x, y } }
 *   key = world-atlas の properties.name (= NE の NAME、110m / 50m とも一意で 110m ⊂ 50m)。
 *         ISO_N3 は属領が本国と同じ番号を持ち一意でないので使わない
 *   en / ja = NAME / NAME_JA
 *   c  = MAPCOLOR9 (隣接国が同色にならないよう NE が計算した 1〜9)。
 *        元データで隣接同色の組があれば、後の方の国を「隣国に無い最小番号」へ機械的に振り直す
 *        (= 一般規則。国ごとの手直しはしない = DESIGN.md)。
 *   x, y = LABEL_X / LABEL_Y (NE が用意している国名ラベルの置き場所、経度・緯度)
 * 取得元: https://github.com/nvkelso/natural-earth-vector (geojson/ne_110m_admin_0_countries.geojson)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { neighbors } from 'topojson-client';

const require = createRequire(import.meta.url);
const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/build-country-names.mjs <ne_50m_admin_0_countries.geojson>');
const ne = JSON.parse(readFileSync(src, 'utf8'));
const topo = require('world-atlas/countries-50m.json');
const geoms = topo.objects.countries.geometries;

const byIso = new Map();
const byName = new Map();
for (const f of ne.features) {
  const q = f.properties;
  byIso.set(String(q.ISO_N3), q);
  byName.set(q.NAME, q);
  byName.set(q.NAME_LONG, q);
  byName.set(q.ADMIN, q);
}
const keyOf = (g) => g.properties.name;
const propOf = (g) => byName.get(g.properties.name) || (g.id !== undefined && byIso.get(String(g.id)));
{
  const names = geoms.map(keyOf);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if (dup.length) throw new Error(`duplicate names: ${dup.join(', ')}`);
}

const out = {};
for (const g of geoms) {
  const q = propOf(g);
  if (!q) throw new Error(`no NE match for ${keyOf(g)}`);
  if (!q.NAME_JA) console.warn(`no NAME_JA for ${q.NAME}, falling back to NAME`);
  if (out[keyOf(g)]) throw new Error(`duplicate key ${keyOf(g)} (${q.NAME})`);
  out[keyOf(g)] = { en: q.NAME, ja: q.NAME_JA || q.NAME, c: q.MAPCOLOR9, x: Number(q.LABEL_X.toFixed(2)), y: Number(q.LABEL_Y.toFixed(2)) };
}

// 隣接同色の機械的解消 (一般規則)
const nb = neighbors(geoms);
const NCOLORS = 9;
geoms.forEach((a, i) => {
  for (const j of nb[i]) {
    if (j <= i || out[keyOf(a)].c !== out[keyOf(geoms[j])].c) continue;
    const used = new Set(nb[j].map((k) => out[keyOf(geoms[k])].c));
    for (let c = 1; c <= NCOLORS; c += 1) {
      if (!used.has(c)) {
        console.log(`recolor ${out[keyOf(geoms[j])].en}: ${out[keyOf(geoms[j])].c} -> ${c} (clash with ${out[keyOf(a)].en})`);
        out[keyOf(geoms[j])].c = c;
        break;
      }
    }
  }
});

writeFileSync(new URL('../src/data/country-names.json', import.meta.url), JSON.stringify(out));
console.log(`wrote ${Object.keys(out).length} countries`);
