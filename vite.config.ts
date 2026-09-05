import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 成果物は docs/index.html の 1 ファイルだけになる (JS / CSS / TopoJSON を全て inline)。
// 教材としてダブルクリック起動・USB 配布・GitHub Pages 設置のどれにも耐えるための構成。
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    // GitHub Pages を「main ブランチの /docs」で配信するため、成果物は docs/ に出す
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    // 単一ファイル化が目的なので、分割されていないこと自体を警告させない
    chunkSizeWarningLimit: 4096,
  },
});
