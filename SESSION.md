# SESSION.md — equal-earth-viewer

> 📌 SESSION.md = 案件ごとの現在地 + 正本への link (進んだら置き換える、 日付を見出しにした節・commit hash・messageId を置かない = 層1 claude-config/CONVENTIONS.md#session-no-durable-record)。 日付つきの節は SESSION-archive.md へ verbatim MOVE 済 (2026-09-28)。

## 知見の置き場

- **一般則 (他 project で再利用)** = 層1 [`claude-config/conventions/web-map-projections.md`](../claude-config/conventions/web-map-projections.md)
- **この project の判断史 (なぜそうしたか・撤回したもの)** = [`DESIGN.md`](DESIGN.md)
- **触るときの注意** = [`CLAUDE.md`](CLAUDE.md)
- 当日の user 指摘による訂正一覧 = odakin-prefs `work-discipline-archive.md §2026-09-05`

- UI 検証: ブラウザの360px / 1100px幅、日英切替、国表示、南を上に、プリセット、任意経度、回転停止、方位図法の緯度入力を確認。

## 未確認

- 実ブラウザでの SVG / PNG 書き出し (内蔵ブラウザはダウンロードを遮断するため未検証)
- 実機スマホでの操作感 (ピンチ・スワイプは合成イベントで検証しただけ)

## 引き継ぎ

- 未完了の実装作業なし。今回の一般則は共通の `web-map-projections.md` に昇格済み、DESIGN.md から該当節を参照。

## 次にやるなら

- 使ってみて出た要望
- 地図上でホイールがページスクロールを奪うのが気になれば「Ctrl+ホイールのみ拡大」に変更
