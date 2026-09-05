import './style.css';
import { syncControlsUi, wireControls } from './controls';
import { renderInto } from './map';
import { readStateFromUrl, syncUrl, type AppState } from './state';
import { currentTheme } from './theme';

const svg = document.querySelector<SVGSVGElement>('#map');
if (svg === null) throw new Error('#map が見つかりません');

const state: AppState = readStateFromUrl();

function render(commit = true): void {
  // 動かしている間 (commit=false) は 110m で軽く、止まったら 50m で描き直す
  renderInto(svg as SVGSVGElement, state, currentTheme(), commit ? 'high' : 'low');
  syncControlsUi(state);
}

/**
 * 状態変更の唯一の入口。commit=false は回転アニメーション中の呼び出しで、
 * 描画だけ行い URL は更新しない (replaceState の連打を避ける)。
 */
function setState(patch: Partial<AppState>, commit = true): void {
  Object.assign(state, patch);
  render(commit);
  if (commit) syncUrl(state);
}

wireControls({ getState: () => state, setState });
render();
// 壊れた / 冗長なクエリを起動時に正規化しておく
syncUrl(state);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render());
