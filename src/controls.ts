import { downloadPng, downloadSvg } from './export';
import { formatLon, wrapLon } from './geo';
import { PROJECTIONS, describeProjection, findProjection } from './projections';
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
  const slider = must<HTMLInputElement>('#lon-slider');
  const number = must<HTMLInputElement>('#lon-number');
  const spinBtn = must<HTMLButtonElement>('#spin');
  const projSelect = must<HTMLSelectElement>('#proj-select');

  for (const def of PROJECTIONS) {
    const opt = document.createElement('option');
    opt.value = def.id;
    opt.textContent = def.label;
    projSelect.appendChild(opt);
  }

  let spinning = false;
  let rafId = 0;
  let lastTime = 0;

  function stopSpin(): void {
    if (!spinning) return;
    spinning = false;
    cancelAnimationFrame(rafId);
    spinBtn.textContent = '回す';
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
    spinBtn.textContent = '停止';
    spinBtn.setAttribute('aria-pressed', 'true');
    rafId = requestAnimationFrame(step);
  }

  /** 手動操作は常に回転より優先し、回転を止める (仕様: フラグで排他)。 */
  function setLonByUser(value: number): void {
    if (!Number.isFinite(value)) return;
    stopSpin();
    host.setState({ lon: Math.max(-180, Math.min(180, value)) }, true);
  }

  slider.addEventListener('input', () => setLonByUser(Number(slider.value)));
  number.addEventListener('input', () => setLonByUser(Number(number.value)));

  for (const btn of document.querySelectorAll<HTMLButtonElement>('.preset')) {
    btn.addEventListener('click', () => setLonByUser(Number(btn.dataset['lon'])));
  }

  spinBtn.addEventListener('click', () => (spinning ? stopSpin() : startSpin()));

  projSelect.addEventListener('change', () => {
    host.setState({ projectionId: projSelect.value }, true);
  });

  const toggles: ReadonlyArray<[string, keyof AppState]> = [
    ['#toggle-graticule', 'showGraticule'],
    ['#toggle-land', 'showLand'],
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

/** state の値を各コントロールの表示に反映する (描画のたびに呼ぶ)。 */
export function syncControlsUi(state: AppState): void {
  const rounded = Math.round(state.lon);
  const slider = must<HTMLInputElement>('#lon-slider');
  const number = must<HTMLInputElement>('#lon-number');

  // 入力中の要素は上書きしない (カーソルが飛ぶため)
  if (document.activeElement !== slider) slider.value = String(rounded);
  if (document.activeElement !== number) number.value = String(rounded);

  must<HTMLSelectElement>('#proj-select').value = state.projectionId;
  must<HTMLInputElement>('#toggle-graticule').checked = state.showGraticule;
  must<HTMLInputElement>('#toggle-land').checked = state.showLand;
  must<HTMLInputElement>('#toggle-tissot').checked = state.showTissot;

  must<HTMLElement>('#lon-readout').textContent = formatLon(state.lon);
  must<HTMLElement>('#seam-readout').textContent = formatLon(state.lon + 180);
  must<HTMLElement>('#proj-note').textContent = describeProjection(
    findProjection(state.projectionId),
  );
}
