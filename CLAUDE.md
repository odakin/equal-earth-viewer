# CLAUDE.md — equal-earth-viewer

Equal Earth 図法の世界地図を描き、中央経線をインタラクティブに動かせる単一ページのウェブアプリ。
地図図法の教材として使う。UI は日本語 / 英語 (`navigator.language` で自動判定、`?lang=` と切替ボタンで上書き)。

## 実行

⚠️ **node は PATH に載っていないことがある** (nvm 管理)。`node: command not found` が出たら:

```sh
export PATH="$HOME/.nvm/versions/node/v20.20.0/bin:$PATH"
```

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー (既定 5173) |
| `npm run build` | `tsc --noEmit` → `vite build` → **`docs/index.html` 1 ファイル**を生成 |
| `npm test` | 投影ロジックの回帰テスト (`scripts/verify.mjs`、DOM 不要) |
| `npm run typecheck` | 型チェックのみ |

## 配布

`npm run build` の成果物は **`docs/index.html` ただ 1 つ** (約 160 KB)。JS / CSS / 海岸線 TopoJSON を
すべて inline 済み (UI 文字列の ja / en 両方を含む) なので、以下のいずれでもそのまま動く:

- ファイルをダブルクリック (`file://` で開く。ビルド環境もネットワークも不要)
- USB / メール / Dropbox で配布
- 静的ホスティングに設置 (GitHub Pages 等)

## 構造

```
index.html          Vite のエントリ (ルート直下。public/ に置くと Vite が処理しない)
vite.config.ts      singlefile プラグイン設定
scripts/verify.mjs  投影ロジックの回帰テスト
scripts/build-country-names.mjs  国名・配色表の生成 (入力 = Natural Earth 110m admin_0 geojson、リポには含めない)
src/
  main.ts           起動・状態の集約・render の呼び出し
  state.ts          AppState の型と URL 同期
  i18n.ts           UI 文字列の ja / en 辞書と data-i18n 適用 (別ページは作らない)
  projections.ts    図法の定義一覧 (名前・族・ファクトリ・極が線か。すべて正積 = verify.mjs F が実測)
  geo.ts            国 / 陸地 (= 国の merge) / 国境 / 経緯線 / ティソー円の GeoJSON + 国名 lookup
  data/country-names.json  国 key → {en, ja, c} (`scripts/build-country-names.mjs` が Natural Earth 110m admin_0 の NAME / NAME_JA / MAPCOLOR9 から生成、177 か国)
  map.ts            描画ロジック (renderInto に集約)
  controls.ts       コントロールのイベント配線と UI 同期
  export.ts         SVG / PNG 書き出し
  theme.ts          地図の配色 (SVG に焼く値の正本)
  style.css         UI の配色・レイアウト
  types/externals.d.ts  d3-geo-projection と TopoJSON の型宣言
```

状態は `main.ts` が持つ単一の `AppState` で、変更は必ず `setState()` を通り、そこから `render()` が呼ばれる。

## URL 状態

`?lon=150&proj=mollweide&tissot=1` の形で復元できる。地図の横ドラッグ / スワイプでも `lon` が動く (`controls.ts` の `wireMapDrag`)。既定値と同じ項目は URL に書かないので短く保たれる。

| キー | 意味 |
|---|---|
| `lon` | 中央経線 (-180〜180)。既定は -90 (アメリカ中心) |
| `lat` | 中心緯度 (-90〜90)。方位図法 (`oblique`) のときだけ効く。既定 0 |
| `proj` | `projections.ts` の id (11 種、すべて正積: equal-earth / mollweide / sinusoidal / eckert4 / lambert-cea / behrmann / gall-peters / hammer / wagner7 / bonne / lambert-azimuthal) |
| `grat` `tissot` `countries` | 経緯線 / ティソー円 / 国 (塗り分け+国境+国名) の表示 (`1` / `0`)。陸地は常に描く |
| `south` | `1` で南を上に (地図全体を 180° 回転、鏡像ではない) |
| `z` `py` | 拡大率 (1〜3、1 なら省略) と縦ずらし (SVG 座標)。viewBox の切り出しで実現 |
| `lang` | `ja` / `en`。自動判定と同じなら書かない (共有先は自分の言語で開く) |

## 触るときの注意

- **中央経線は `projection.rotate([-lon, 0, 0])` だけで表現する。** 反子午線での切断は d3-geo の
  標準クリップに任せ、ポリゴンを自前で分割しない。
- **`map.ts` は図法ごとに `fitWidth` を 1 回だけ実行して拡大率と高さをキャッシュする。** これは
  「経度回転では投影された球の外郭が合同」という性質に依存している。斜軸投影 (rotate の第 2・第 3
  引数) を導入するとこの前提が崩れるので、そのときはキャッシュ設計から見直すこと。例外は
  `oblique: true` の方位図法で、外郭が常に円なので第 2 引数 (中心緯度) を使っても無事 (項目 A2)。前提は
  `npm test` の項目 A が実測で守っている (擬円錐・方位でも成立することを確認済)。
- **図法を追加したら `scripts/verify.mjs` の PROJECTIONS 鏡にも足す** (極の扱い E / 正積 F / 外郭不変 A を実測で検査)。
- **地図の色は `theme.ts` が正本** (CSS 変数ではない)。SVG / PNG 書き出しでは外部 CSS が効かないため、
  色は SVG 内の `<style>` に焼き込んでいる。画面と書き出しで色が食い違わないよう、
  画面表示も書き出しも同じ `renderInto()` を通す。
