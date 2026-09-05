# SESSION.md — equal-earth-viewer

## 現在地 (2026-09-05)

初版を実装し、公開まで完了。仕様書の必須 (1〜5) と「望ましい」(6〜9) を全て実装済み。

- 公開 URL: **https://odakin.github.io/equal-earth-viewer/** (GitHub Pages、`master` の `docs/` から配信)
- `npm run build` は警告なしで通り、`docs/index.html` 単一ファイル (約 96 KB) を出力 (再ビルドで差分なし)
- `npm test` (`scripts/verify.mjs`) 全項目 pass
- `npx tsc --noEmit` エラーなし
- security baseline 適用済 (Dependabot / CodeQL / Semgrep / push protection / branch protection / public-repo leak gate marker)
  — workflow 2 本は gh token に `workflow` scope が無く API では載らないため git push で追加

## ブラウザ目視確認 (2026-09-05、dev server + 内蔵ブラウザ)

以下すべて問題なし、調整不要と判断:

- 初期表示 (0°) / プリセット 150°E でグリーンランドが左右に分断 / URL が `?lon=150` に同期
- ティソー円表示 + Gall-Peters 切替 → URL `?lon=150&proj=gall-peters&tissot=1`
- スマホ幅 (375px): コントロールが縦積みに折り返し、地図は横幅いっぱい、横スクロールなし
- ダークモード: UI は暗色、地図の配色は変わらず (theme.ts が正本の設計どおり)
- 「回す」: 回転開始・停止、停止時に URL 確定。console エラーなし
- 未確認: SVG / PNG 書き出し (内蔵ブラウザはダウンロードを遮断するため実ブラウザで要確認)

## dev server

Claude Code の `~/Claude/.claude/launch.json` に `equal-earth-viewer` (port 5175) を登録済み。
手動なら `npm run dev`。

## 次にやるなら

- 実ブラウザで SVG / PNG 書き出しの目視 (色が焼き込まれているか)
- 教材として使ってみて出た要望
