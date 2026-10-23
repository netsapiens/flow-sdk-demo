/**
 * Highlight extensions: a presenter tool that outlines every piece this app
 * contributes to Flow, so a demo or a screenshot shows what is SDK and what is
 * native.
 *
 * It finds the pieces by the marker they already carry for the Playwright
 * suite (`data-testid="sdk-demo-…"`, see withZoneTestId and the manifest), so
 * nothing else changes to support it. Anything not outlined is Flow's own.
 *
 * CARVE-OUT (CLAUDE.md, "Carve-outs" 4): this draws plain DOM over the page
 * instead of using `flowContext.ui`. It is not app UI: it sits above the host
 * page, ignores the pointer, and uses one fixed orange that reads on light and
 * dark alike. Approved for UGM 2026 as a presentation aid. Keep it to this one
 * module; app UI still comes from the kit.
 */

const MARKER = '[data-testid^="sdk-demo-"]';
/** The toggle itself is an extension too; outlining it would only add noise. */
const SELF_TEST_ID = 'sdk-demo-ext-topbar-highlight';
const ORANGE = '#F29919';
const LAYER_ID = 'sdk-demo-highlight-layer';

type Listener = (on: boolean) => void;

let on = false;
let frame = 0;
let layer: HTMLDivElement | null = null;
const listeners = new Set<Listener>();

/** What the label says: the zone for an extension, the kind otherwise. */
function labelFor(el: Element): string {
  const zone = el.getAttribute('data-zone');
  if (zone) return zone;
  const testId = el.getAttribute('data-testid') ?? '';
  for (const [prefix, kind] of [
    ['sdk-demo-page-', 'page'],
    ['sdk-demo-col-', 'column'],
    ['sdk-demo-widget-', 'widget'],
  ] as const) {
    if (testId.startsWith(prefix))
      return `${kind}: ${testId.slice(prefix.length)}`;
  }
  return testId.replace(/^sdk-demo-/, '');
}

function ensureLayer(): HTMLDivElement {
  if (layer && document.body.contains(layer)) return layer;
  layer = document.createElement('div');
  layer.id = LAYER_ID;
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483000',
  });
  document.body.appendChild(layer);
  return layer;
}

function draw() {
  const root = ensureLayer();
  const seen = new Set<string>();
  const boxes: HTMLElement[] = [];
  document.querySelectorAll(MARKER).forEach((el) => {
    const testId = el.getAttribute('data-testid') ?? '';
    if (testId === SELF_TEST_ID) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed',
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      outline: `2px solid ${ORANGE}`,
      outlineOffset: '1px',
      borderRadius: '4px',
      boxSizing: 'border-box',
    });
    // One label per marker: a column's cells all share a testId.
    if (!seen.has(testId)) {
      seen.add(testId);
      const tag = document.createElement('span');
      tag.textContent = labelFor(el);
      Object.assign(tag.style, {
        position: 'absolute',
        left: '0',
        top: r.top > 18 ? '-18px' : '0',
        padding: '1px 6px',
        background: ORANGE,
        color: '#100837',
        font: '600 11px/16px Montserrat, system-ui, sans-serif',
        borderRadius: '3px',
        whiteSpace: 'nowrap',
      });
      box.appendChild(tag);
    }
    boxes.push(box);
  });
  root.replaceChildren(...boxes);
  frame = requestAnimationFrame(draw);
}

function notify() {
  listeners.forEach((l) => l(on));
}

export function isHighlighting(): boolean {
  return on;
}

export function setHighlighting(next: boolean): void {
  if (next === on) return;
  on = next;
  if (on) {
    frame = requestAnimationFrame(draw);
  } else {
    cancelAnimationFrame(frame);
    layer?.remove();
    layer = null;
  }
  notify();
}

export function toggleHighlighting(): void {
  setHighlighting(!on);
}

/** For useSyncExternalStore: re-render the toggle when the state changes. */
export function subscribeHighlighting(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Alt+Shift+H toggles it from anywhere. Returns the cleanup. */
export function installHighlightShortcut(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey && e.shiftKey && e.code === 'KeyH') {
      e.preventDefault();
      toggleHighlighting();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
