import { downloadPng, downloadSvg } from './export';
import { countryName, wrapLon } from './geo';
import { applyLang, t } from './i18n';
import { FAMILIES, PROJECTIONS, describeProjection, findProjection } from './projections';
import { clampZoom, type AppState } from './state';

/** 地球の自転を表す角速度 (度/秒)。陸地を東へ動かすため中央経線は西へ進める。 */
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
    host.setState({ lon: wrapLon(host.getState().lon - SPIN_DEG_PER_SEC * dt) }, false);
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
  wireCountryTip(host);

  must<HTMLButtonElement>('#toggle-south').addEventListener('click', () => {
    host.setState({ southUp: !host.getState().southUp }, true);
  });

  must<HTMLButtonElement>('#toggle-countries').addEventListener('click', () => {
    host.setState({ showCountries: !host.getState().showCountries }, true);
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
  let moved = false;
  let startLon = 0;
  let startLat = 0;
  let startPanY = 0;
  /** ピンチ用: 押されている pointer の位置 */
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchStartDist = 0;
  let pinchStartZoom = 1;

  map.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 2) {
      // 2 本目 = ピンチ開始。回転ドラッグは打ち切る
      dragging = false;
      map.classList.remove('dragging');
      const [a, b] = [...pointers.values()];
      pinchStartDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      pinchStartZoom = host.getState().zoom;
      try {
        map.setPointerCapture(ev.pointerId);
      } catch {
        // 合成イベント等
      }
      return;
    }
    dragging = true;
    moved = false;
    startX = ev.clientX;
    startY = ev.clientY;
    startLon = host.getState().lon;
    startLat = host.getState().lat;
    startPanY = host.getState().panY;
    stopSpin();
    try {
      map.setPointerCapture(ev.pointerId);
    } catch {
      // 合成イベント等で active pointer が無い場合は capture なしで続行
    }
    map.classList.add('dragging');
  });

  map.addEventListener('pointermove', (ev) => {
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size >= 2 && pinchStartDist > 0) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      host.setState({ zoom: clampZoom((pinchStartZoom * d) / pinchStartDist) }, false);
      return;
    }
    if (!dragging) return;
    const width = map.getBoundingClientRect().width;
    if (width === 0) return;
    // 南が上のときは地図が 180° 回っているので、指の動きと経緯の対応が両軸とも逆になる
    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) moved = true;
    if (!moved) return;
    const state = host.getState();
    const sign = state.southUp ? -1 : 1;
    const dx = (ev.clientX - startX) * sign;
    // 右へ動かす = 地図が右へ流れる = 中央経線は西へ (小さく) なる。拡大中は見えている幅 = 360°/zoom
    const patch: Partial<AppState> = { lon: wrapLon(startLon - (dx / width) * (360 / state.zoom)) };
    const rect = map.getBoundingClientRect();
    if (findProjection(state.projectionId).oblique) {
      // 下へ動かす = 指の下の点が下がる = 中心は北へ (緯度が増える)。表示高さ = 180° と見なす
      const dy = (ev.clientY - startY) * sign;
      patch.lat = Math.max(-90, Math.min(90, startLat + (dy / rect.height) * (180 / state.zoom)));
    } else if (state.zoom > 1) {
      // 拡大中の縦ドラッグ = 縦にずらす (SVG 座標へ換算。南が上でも画面の上下はそのまま)
      const svgPerPx = rect.height > 0 ? map.viewBox.baseVal.height / rect.height : 0;
      patch.panY = startPanY - (ev.clientY - startY) * svgPerPx;
    }
    host.setState(patch, false);
  });

  const finish = (ev?: PointerEvent): void => {
    if (ev !== undefined) pointers.delete(ev.pointerId);
    if (pointers.size < 2 && pinchStartDist > 0) {
      // ピンチ終了: 拡大率を確定
      pinchStartDist = 0;
      host.setState({ zoom: Number(host.getState().zoom.toFixed(2)) }, true);
    }
    if (!dragging) return;
    dragging = false;
    map.classList.remove('dragging');
    if (!moved) {
      // 動かさずに離した = タップ。スマホ向けに国名を出す (hover が無いので)
      if (ev !== undefined) map.dispatchEvent(new CustomEvent('maptap', { detail: { x: ev.clientX, y: ev.clientY } }));
      return;
    }
    const s = host.getState();
    host.setState({ lon: Math.round(s.lon), lat: Math.round(s.lat), panY: Math.round(s.panY) }, true);
  };
  map.addEventListener('pointerup', finish);
  map.addEventListener('pointercancel', finish);
  map.addEventListener('lostpointercapture', finish);

  // ホイール / トラックパッドのピンチ (= ctrl+wheel) で拡大。カーソル位置の縦座標を固定する
  map.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      const state = host.getState();
      const rect = map.getBoundingClientRect();
      const vb = map.viewBox.baseVal;
      const factor = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.002));
      const zoom = clampZoom(state.zoom * factor);
      if (zoom === state.zoom) return;
      // カーソル下の SVG y を拡大前後で一致させる
      const fy = (ev.clientY - rect.top) / rect.height;
      const ySvg = vb.y + fy * vb.height;
      const fullHeight = vb.height * state.zoom;
      const vhNew = fullHeight / zoom;
      const yNew = ySvg - fy * vhNew;
      const panY = yNew + vhNew / 2 - fullHeight / 2;
      // レイアウト前 (rect.height = 0) 等で NaN になったら、ずらしは据え置きで拡大だけ行う
      host.setState(
        { zoom: Number(zoom.toFixed(2)), panY: Number.isFinite(panY) ? Math.round(panY) : state.panY },
        true,
      );
    },
    { passive: false },
  );

  // ダブルクリック / ダブルタップで拡大を戻す
  map.addEventListener('dblclick', (ev) => {
    ev.preventDefault();
    host.setState({ zoom: 1, panY: 0 }, true);
  });
}

/**
 * 国名の吹き出し。PC は hover で追従、スマホはタップで 2.5 秒表示。
 * 当たり判定は map.ts が国ごとに置く透明 path (data-key)。
 */
function wireCountryTip(host: ControlsHost): void {
  const map = must<SVGSVGElement>('#map');
  const wrap = must<HTMLElement>('.map-wrap');
  const tip = must<HTMLElement>('#country-tip');
  let hideTimer = 0;

  function keyAt(x: number, y: number): string | null {
    const node = document.elementFromPoint(x, y);
    const path = node?.closest<SVGPathElement>('.countries path');
    return path?.dataset['key'] ?? null;
  }

  function showAt(x: number, y: number, key: string): void {
    const r = wrap.getBoundingClientRect();
    tip.textContent = countryName(key, host.getState().lang);
    tip.style.left = `${x - r.left}px`;
    tip.style.top = `${y - r.top}px`;
    tip.hidden = false;
  }

  function hide(): void {
    tip.hidden = true;
  }

  map.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || !host.getState().showCountries) return;
    if (ev.buttons !== 0) {
      hide();
      return;
    }
    const key = keyAt(ev.clientX, ev.clientY);
    if (key === null) hide();
    else showAt(ev.clientX, ev.clientY, key);
  });
  map.addEventListener('pointerleave', hide);

  map.addEventListener('maptap', (ev) => {
    if (!host.getState().showCountries) return;
    const { x, y } = (ev as CustomEvent<{ x: number; y: number }>).detail;
    const key = keyAt(x, y);
    window.clearTimeout(hideTimer);
    if (key === null) {
      hide();
      return;
    }
    showAt(x, y, key);
    hideTimer = window.setTimeout(hide, 2500);
  });
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
  // 任意の経度では選択なし。丸めた表示値ではなく実際の中心と一致させる。
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.preset')) {
    btn.setAttribute('aria-pressed', String(Math.abs(state.lon - Number(btn.dataset['lon'])) < 1e-6));
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
  must<HTMLButtonElement>('#toggle-countries').setAttribute('aria-pressed', String(state.showCountries));
  must<HTMLButtonElement>('#toggle-south').setAttribute('aria-pressed', state.southUp ? 'true' : 'false');

  const oblique = findProjection(state.projectionId).oblique === true;
  must<HTMLElement>('#lat-row').hidden = !oblique;
  must<HTMLElement>('#drag-hint').textContent = t(state.lang, oblique ? 'drag.hint.oblique' : 'drag.hint');
  must<SVGSVGElement>('#map').style.touchAction = oblique || state.zoom > 1 ? 'none' : 'pan-y';
  must<HTMLElement>('#zoom-readout').textContent = state.zoom > 1 ? `×${state.zoom.toFixed(1)}` : '';
  const latRounded = Math.round(state.lat);
  const latNumber = must<HTMLInputElement>('#lat-number');
  if (document.activeElement !== latNumber) latNumber.value = String(latRounded);
  must<HTMLElement>('#proj-note').textContent = describeProjection(
    findProjection(state.projectionId),
    state.lang,
  );
}
