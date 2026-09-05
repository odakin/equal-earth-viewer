# SESSION.md — equal-earth-viewer

## 現在地

初版を実装。仕様書の必須 (1〜5) と「望ましい」(6〜9) を全て実装済み。

- `npm run build` は警告なしで通り、`docs/index.html` 単一ファイル (約 94 KB) を出力
- `npm test` (`scripts/verify.mjs`) 全項目 pass
- `npx tsc --noEmit` エラーなし

## 未確認

- **ブラウザでの目視確認が未了** — レイアウト・配色・操作感・スマホ幅 (360px) は
  機械検証の射程外。dev server で確認が必要。
- リポジトリは未 `git init`、公開/非公開の判断も未了。

## 次にやるなら

- 目視確認で出た調整
- 公開する場合は GitHub Pages 設置 (`docs/index.html` を置くだけ)
