import { downloadPng, downloadSvg } from './export';
import { formatLat, formatLon, wrapLon } from './geo';
import { applyLang, t } from './i18n';
import { FAMILIES, PROJECTIONS, describeProjection, findProjection } from './projections';
import type { AppState } from './state';

/** 「回す」の角速度 (度/秒)。 */
const SPIN_DEG_PER_SEC = 30;

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (node === null) throw new Error(`要素が見つかりません: ${selector}`);
  return node;
}

export interface ControlsHost {
  getState: () => AppState;
  /** URL 同期は commit=true のときだけ行う (回転中の replaceState 連打を避ける)。 */
  setState: (patch: Partial<AppState>, commit?: boolean) => void;
}

export function wireControls(host: ControlsHost): void {
  const number = must<HTMLInputElement>('#lon-number');
  const spinBtn = must<HTMLButtonElement>('#spin');
  const latNumber = must<HTMLInputElement>('#lat-number');
  // 図法はプルダウンでなく押しボタンの並び (族ごとに 1 行)。文言は syncControlsUi が言語に合わせて流し込む。
  const projList = must<HTMLElement>('#proj-list');
  for (const family of FAMILIES) {
    const row = document.createElement('div');
    row.className = 'row proj-row';
    const head = document.createElement('span');
    head.className = 'family-label';
    head.dataset['family'] = family;
    row.appendChild(head);
    for (const def of PROJECTIONS) {
      if (def.family !== family) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'proj';
      btn.dataset['id'] = def.id;
      btn.addEventListener('click', () => host.setState({ projectionId: def.id }, true));
      row.appendChild(btn);
    }
    projList.appendChild(row);
  }

  let spinning = false;
  let rafId = 0;
  let lastTime = 0;

  function stopSpin(): void {
    if (!spinning) return;
    spinning = false;
    cancelAnimationFrame(rafId);
    spinBtn.textContent = t(host.getState().lang, 'spin.start');
    spinBtn.setAttribute('aria-pressed', 'false');
    // 回転中は URL を更新していないので、止まった位置をここで確定する
    host.setState({}, true);
  }

  function step(now: number): void {
    if (!spinning) return;
    const dt = lastTime === 0 ? 0 : (now - lastTime) / 1000;
    lastTime = now;
    host.setState({ lon: wrapLon(host.getState().lon + SPIN_DEG_PER_SEC * dt) }, false);
    rafId = requestAnimationFrame(step);
  }

  function startSpin(): void {
    if (spinning) return;
    spinning = true;
    lastTime = 0;
    spinBtn.textContent = t(host.getState().lang, 'spin.stop');
    spinBtn.setAttribute('aria-pressed', 'true');
    rafId = requestAnimationFrame(step);
  }

  /** 手動操作は常に回転より優先し、回転を止める (仕様: フラグで排他)。 */
  function setLonByUser(value: number): void {
    if (!Number.isFinite(value)) return;
    stopSpin();
    host.setState({ lon: Math.max(-180, Math.min(180, value)) }, true);
  }

  number.addEventListener('input', () => setLonByUser(Number(number.value)));

  for (const btn of document.querySelectorAll<HTMLButtonElement>('.preset')) {
    btn.addEventListener('click', () => setLonByUser(Number(btn.dataset['lon'])));
  }

  function setLatByUser(value: number): void {
    if (!Number.isFinite(value)) return;
    host.setState({ lat: Math.max(-90, Math.min(90, value)) }, true);
  }
  latNumber.addEventListener('input', () => setLatByUser(Number(latNumber.value)));

  spinBtn.addEventListener('click', () => (spinning ? stopSpin() : startSpin()));

  wireMapDrag(host, stopSpin);

  must<HTMLButtonElement>('#toggle-south').addEventListener('click', () => {
    host.setState({ southUp: !host.getState().southUp }, true);
  });

  must<HTMLButtonElement>('#lang-toggle').addEventListener('click', () => {
    host.setState({ lang: host.getState().lang === 'ja' ? 'en' : 'ja' }, true);
  });

  const toggles: ReadonlyArray<[string, keyof AppState]> = [
    ['#toggle-graticule', 'showGraticule'],
    ['#toggle-tissot', 'showTissot'],
  ];
  for (const [selector, key] of toggles) {
    const box = must<HTMLInputElement>(selector);
    box.addEventListener('change', () => host.setState({ [key]: box.checked }, true));
  }

  must<HTMLButtonElement>('#export-svg').addEventListener('click', () => {
    downloadSvg(host.getState());
  });
  must<HTMLButtonElement>('#export-png').addEventListener('click', () => {
    void downloadPng(host.getState());
  });
}

/**
 * 地図を左右にドラッグ / スワイプして中央経線を動かす。
 * 地図の表示幅 = 経度 360° と見なし、動かした距離をそのまま経度に換算する
 * (指の下の経線がほぼ指に付いてくる)。縦方向は通常 CSS の touch-action: pan-y で
 * ブラウザのスクロールに譲る。方位図法 (oblique) のときだけ縦も中心緯度に使い、
 * touch-action は syncControlsUi が none に切り替える。
 */
function wireMapDrag(host: ControlsHost, stopSpin: () => void): void {
  const map = must<SVGSVGElement>('#map');
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLon = 0;
  let startLat = 0;

  map.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    dragging = true;
    startX = ev.clientX;
    startY = ev.clientY;
    startLon = host.getState().lon;
    startLat = host.getState().lat;
    stopSpin();
    try {
      map.setPointerCapture(ev.pointerId);
    } catch {
      // 合成イベント等で active pointer が無い場合は capture なしで続行
    }
    map.classList.add('dragging');
  });

  map.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const width = map.getBoundingClientRect().width;
    if (width === 0) return;
    // 南が上のときは地図が 180° 回っているので、指の動きと経緯の対応が両軸とも逆になる
    const sign = host.getState().southUp ? -1 : 1;
    const dx = (ev.clientX - startX) * sign;
    // 右へ動かす = 地図が右へ流れる = 中央経線は西へ (小さく) なる
    const patch: Partial<AppState> = { lon: wrapLon(startLon - (dx / width) * 360) };
    if (findProjection(host.getState().projectionId).oblique) {
      // 下へ動かす = 指の下の点が下がる = 中心は北へ (緯度が増える)。表示高さ = 180° と見なす
      const height = map.getBoundingClientRect().height;
      const dy = (ev.clientY - startY) * sign;
      patch.lat = Math.max(-90, Math.min(90, startLat + (dy / height) * 180));
    }
    host.setState(patch, false);
  });

  const finish = (): void => {
    if (!dragging) return;
    dragging = false;
    map.classList.remove('dragging');
    const s = host.getState();
    host.setState({ lon: Math.round(s.lon), lat: Math.round(s.lat) }, true);
  };
  map.addEventListener('pointerup', finish);
  map.addEventListener('pointercancel', finish);
  map.addEventListener('lostpointercapture', finish);
}

/** state の値を各コントロールの表示に反映する (描画のたびに呼ぶ)。 */
export function syncControlsUi(state: AppState): void {
  if (document.documentElement.lang !== state.lang) {
    applyLang(state.lang);
    // 「回す / 停止」は applyLang の対象外 (状態依存) なので、押下中でなければここで揃える
    const spinBtn = must<HTMLButtonElement>('#spin');
    if (spinBtn.getAttribute('aria-pressed') !== 'true') {
      spinBtn.textContent = t(state.lang, 'spin.start');
    } else {
      spinBtn.textContent = t(state.lang, 'spin.stop');
    }
  }
  const rounded = Math.round(state.lon);
  const number = must<HTMLInputElement>('#lon-number');

  // 入力中の要素は上書きしない (カーソルが飛ぶため)
  if (document.activeElement !== number) number.value = String(rounded);

  for (const btn of document.querySelectorAll<HTMLButtonElement>('#proj-list .proj')) {
    const id = btn.dataset['id'] ?? '';
    btn.textContent = findProjection(id).label[state.lang];
    btn.setAttribute('aria-pressed', id === state.projectionId ? 'true' : 'false');
  }
  for (const head of document.querySelectorAll<HTMLElement>('#proj-list .family-label')) {
    head.textContent = t(state.lang, `family.${head.dataset['family'] ?? ''}`);
  }
  must<HTMLInputElement>('#toggle-graticule').checked = state.showGraticule;
  must<HTMLInputElement>('#toggle-tissot').checked = state.showTissot;
  must<HTMLButtonElement>('#toggle-south').setAttribute('aria-pressed', state.southUp ? 'true' : 'false');

  const oblique = findProjection(state.projectionId).oblique === true;
  must<HTMLElement>('#lat-row').hidden = !oblique;
  must<HTMLElement>('#lat-readout-wrap').hidden = !oblique;
  must<HTMLElement>('#drag-hint').textContent = t(state.lang, oblique ? 'drag.hint.oblique' : 'drag.hint');
  must<SVGSVGElement>('#map').style.touchAction = oblique ? 'none' : 'pan-y';
  const latRounded = Math.round(state.lat);
  const latNumber = must<HTMLInputElement>('#lat-number');
  if (document.activeElement !== latNumber) latNumber.value = String(latRounded);
  must<HTMLElement>('#lat-readout').textContent = formatLat(state.lat, state.lang);
  must<HTMLElement>('#lon-readout').textContent = formatLon(state.lon, state.lang);
  must<HTMLElement>('#seam-readout').textContent = formatLon(state.lon + 180, state.lang);
  must<HTMLElement>('#proj-note').textContent = describeProjection(
    findProjection(state.projectionId),
    state.lang,
  );
}
