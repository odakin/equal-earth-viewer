import { detectLang, isLang, type Lang } from './i18n';
import { PROJECTIONS, findProjection } from './projections';

export interface AppState {
  /** 中央経線 [-180, 180]。アニメーション中は連続値を取る。 */
  lon: number;
  /** 中心緯度 [-90, 90]。方位図法 (oblique) のときだけ描画に効く */
  lat: number;
  projectionId: string;
  showGraticule: boolean;
  showTissot: boolean;
  /** 南を上にする (地図全体を 180° 回転。鏡像ではない) */
  southUp: boolean;
  /** UI 言語。既定は navigator.language から判定 */
  lang: Lang;
}

export const DEFAULT_STATE: Readonly<AppState> = {
  // 既定はアメリカ中心 90°W (Patterson の Equal Earth 壁地図 3 版のうち Americas 版の中央経線)
  lon: -90,
  lat: 0,
  projectionId: 'equal-earth',
  showGraticule: true,
  showTissot: false,
  southUp: false,
  lang: detectLang(),
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

  const latRaw = q.get('lat');
  const lat = latRaw === null ? Number.NaN : Number(latRaw);
  if (Number.isFinite(lat)) state.lat = Math.max(-90, Math.min(90, lat));

  const proj = q.get('proj');
  if (proj !== null && PROJECTIONS.some((p) => p.id === proj)) state.projectionId = proj;

  state.showGraticule = parseBool(q.get('grat'), DEFAULT_STATE.showGraticule);
  state.showTissot = parseBool(q.get('tissot'), DEFAULT_STATE.showTissot);
  state.southUp = parseBool(q.get('south'), DEFAULT_STATE.southUp);

  const lang = q.get('lang');
  if (isLang(lang)) state.lang = lang;

  return state;
}

/** 既定値と同じ項目は書かないので、URL は共有しやすい短さに保たれる。 */
export function stateToQuery(state: AppState): string {
  const q = new URLSearchParams();
  const lon = Math.round(state.lon);
  if (lon !== DEFAULT_STATE.lon) q.set('lon', String(lon));
  // lat は方位図法でしか効かないので、それ以外の図法では URL に書かない (値自体は state に保持)
  const lat = Math.round(state.lat);
  if (lat !== DEFAULT_STATE.lat && findProjection(state.projectionId).oblique) q.set('lat', String(lat));
  if (state.projectionId !== DEFAULT_STATE.projectionId) q.set('proj', state.projectionId);
  if (state.showGraticule !== DEFAULT_STATE.showGraticule) q.set('grat', state.showGraticule ? '1' : '0');
  if (state.showTissot !== DEFAULT_STATE.showTissot) q.set('tissot', state.showTissot ? '1' : '0');
  if (state.southUp !== DEFAULT_STATE.southUp) q.set('south', state.southUp ? '1' : '0');
  // 自動判定と同じ言語なら書かない (共有先の閲覧者は自分の言語で開ける)
  if (state.lang !== DEFAULT_STATE.lang) q.set('lang', state.lang);
  const s = q.toString();
  return s === '' ? window.location.pathname : `?${s}`;
}

export function syncUrl(state: AppState): void {
  history.replaceState(null, '', stateToQuery(state));
}
