/**
 * src/data/country-names.json を Natural Earth 110m admin_0 (public domain) から生成する。
 *
 *   node scripts/build-country-names.mjs <ne_110m_admin_0_countries.geojson>
 *
 * 出力: { <key>: { en, ja, c } }
 *   key = world-atlas countries-110m の id (ISO 3166-1 numeric)。無い 3 国は "n:<name>"
 *   en / ja = NAME / NAME_JA
 *   c  = MAPCOLOR9 (隣接国が同色にならないよう NE が計算した 1〜9)。
 *        元データで隣接同色の組があれば、後の方の国を「隣国に無い最小番号」へ機械的に振り直す
 *        (= 一般規則。国ごとの手直しはしない = DESIGN.md)。
 * 取得元: https://github.com/nvkelso/natural-earth-vector (geojson/ne_110m_admin_0_countries.geojson)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { neighbors } from 'topojson-client';

const require = createRequire(import.meta.url);
const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/build-country-names.mjs <ne_110m_admin_0_countries.geojson>');
const ne = JSON.parse(readFileSync(src, 'utf8'));
const topo = require('world-atlas/countries-110m.json');
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
const keyOf = (g) => (g.id !== undefined ? String(g.id) : `n:${g.properties.name}`);
const propOf = (g) => (g.id !== undefined && byIso.get(String(g.id))) || byName.get(g.properties.name);

const out = {};
for (const g of geoms) {
  const q = propOf(g);
  if (!q) throw new Error(`no NE match for ${keyOf(g)}`);
  if (!q.NAME_JA) throw new Error(`no NAME_JA for ${q.NAME}`);
  out[keyOf(g)] = { en: q.NAME, ja: q.NAME_JA, c: q.MAPCOLOR9 };
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
