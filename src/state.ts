import { PROJECTIONS } from './projections';

export interface AppState {
  /** 中央経線 [-180, 180]。アニメーション中は連続値を取る。 */
  lon: number;
  projectionId: string;
  showGraticule: boolean;
  showLand: boolean;
  showTissot: boolean;
}

export const DEFAULT_STATE: Readonly<AppState> = {
  // 既定はアメリカ中心 90°W (Patterson の Equal Earth 壁地図 3 版のうち Americas 版の中央経線)
  lon: -90,
  projectionId: 'equal-earth',
  showGraticule: true,
  showLand: true,
  showTissot: false,
};

function parseBool(v: string | null, fallback: boolean): boolean {
  if (v === null) return fallback;
  return v === '1' || v === 'true';
}

/** URL のクエリから状態を復元する。壊れた値は既定値に落とす。 */
export function readStateFromUrl(search: string = window.location.search): AppState {
  const q = new URLSearchParams(search);
  const state: AppState = { ...DEFAULT_STATE };

  // q.get が null のとき Number(null) は 0 になるので、キー不在は先に弾く
  // (既定値が 0 だった間は同じ結果になり気づかなかった潜在バグ)
  const lonRaw = q.get('lon');
  const lon = lonRaw === null ? Number.NaN : Number(lonRaw);
  if (Number.isFinite(lon)) state.lon = Math.max(-180, Math.min(180, lon));

  const proj = q.get('proj');
  if (proj !== null && PROJECTIONS.some((p) => p.id === proj)) state.projectionId = proj;

  state.showGraticule = parseBool(q.get('grat'), DEFAULT_STATE.showGraticule);
  state.showLand = parseBool(q.get('land'), DEFAULT_STATE.showLand);
  state.showTissot = parseBool(q.get('tissot'), DEFAULT_STATE.showTissot);

  return state;
}

/** 既定値と同じ項目は書かないので、URL は共有しやすい短さに保たれる。 */
export function stateToQuery(state: AppState): string {
  const q = new URLSearchParams();
  const lon = Math.round(state.lon);
  if (lon !== DEFAULT_STATE.lon) q.set('lon', String(lon));
  if (state.projectionId !== DEFAULT_STATE.projectionId) q.set('proj', state.projectionId);
  if (state.showGraticule !== DEFAULT_STATE.showGraticule) q.set('grat', state.showGraticule ? '1' : '0');
  if (state.showLand !== DEFAULT_STATE.showLand) q.set('land', state.showLand ? '1' : '0');
  if (state.showTissot !== DEFAULT_STATE.showTissot) q.set('tissot', state.showTissot ? '1' : '0');
  const s = q.toString();
  return s === '' ? window.location.pathname : `?${s}`;
}

export function syncUrl(state: AppState): void {
  history.replaceState(null, '', stateToQuery(state));
}
