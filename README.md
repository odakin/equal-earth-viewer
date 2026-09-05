# イコールアース図法ビューア / Equal Earth Projection Viewer

正積 (面積が正しい) 図法の世界地図を、中央経線を動かしながら眺めるための単一ページ教材。

**https://odakin.github.io/equal-earth-viewer/** (英語 UI: `?lang=en`)

## できること

- 11 の正積図法を切り替える (イコールアース / モルワイデ / サンソン / エケルト第4 / ランベルト正積円筒 / ベールマン / ゴール・ピーターズ / ハンマー / ワグナー第7 / ボンヌ / ランベルト正積方位)
- 地図をドラッグ (スワイプ) して中央経線を回す。方位図法は上下にも動く
- プリセット: アメリカ中心 西経90° / 太平洋中心 東経150° / ヨーロッパ・アフリカ中心 0° (Patterson の壁地図 3 版の中央経線)
- 回す / 南を上に (180° 回転)
- 経緯線、ティソーの指示楕円、国 (塗り分け・国境・国名、ホバーかタップで国名) の表示
- ホイール / ピンチで 8 倍まで拡大。寄るほど小さな国の名前が現れる
- SVG / PNG 書き出し。URL に状態が入るので、見ている状態をそのまま共有できる

## 配布

`docs/index.html` 1 ファイルで動きます (JS / CSS / 海岸線データをすべて内蔵、約 950 KB)。
ダブルクリックで開く、USB やメールで渡す、静的ホスティングに置く、のどれでも同じです。

## 開発

```sh
npm ci
npm run dev      # http://localhost:5173
npm test         # 投影の回帰テスト (図法の正積・極の扱い・外郭不変・国名表を実測)
npm run build    # docs/index.html を生成
```

国名と配色の表 (`src/data/country-names.json`) は Natural Earth の 50m admin_0 geojson から
`scripts/build-country-names.mjs` で生成します (geojson はリポに含めません)。

## データと出典

- 図法: Šavrič, Patterson & Jenny, *Int. J. Geogr. Inf. Sci.* 33, 454 (2019; online 2018)、ほか d3-geo / d3-geo-projection の実装
- 海岸線・国境・国名・配色: [Natural Earth](https://www.naturalearthdata.com/) 50m / 110m (public domain)、[world-atlas](https://github.com/topojson/world-atlas) 経由
- 描画: [d3-geo](https://github.com/d3/d3-geo)、[topojson](https://github.com/topojson)
