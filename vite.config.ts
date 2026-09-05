import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 成果物は dist/index.html の 1 ファイルだけになる (JS / CSS / TopoJSON を全て inline)。
// 教材としてダブルクリック起動・USB 配布・GitHub Pages 設置のどれにも耐えるための構成。
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    // 単一ファイル化が目的なので、分割されていないこと自体を警告させない
    chunkSizeWarningLimit: 4096,
  },
});
