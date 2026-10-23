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

import manifestJson from './zones.manifest.json';

/**
 * The app's menu entries. Flow draws them itself, as `nav-item-<path>`
 * (sidenav NavItem and SlimNavItem), so they carry no `sdk-demo-` marker; they
 * are found by the paths this app registers.
 */
const MENU_PATHS = new Set(
  (manifestJson.routes as { path: string }[]).map((route) => route.path),
);
const MENU_MARKER = [...MENU_PATHS].map((p) => `[data-testid="nav-item-${p}"]`);

const MARKER = ['[data-testid^="sdk-demo-"]', ...MENU_MARKER].join(', ');
/** The toggle itself is an extension too; outlining it would only add noise. */
const SELF_TEST_ID = 'sdk-demo-ext-topbar-highlight';
const ORANGE = '#F29919';
const LAYER_ID = 'sdk-demo-highlight-layer';
/** Marker the app puts on its side-panel content; the panel's drawer is outlined. */
export const PANEL_PREFIX = 'sdk-demo-panel-';
/**
 * Two layers, so an open drawer covers what is under it. Flow uses MUI's
 * default stacking: app bar 1100, drawer 1200, modal 1300. Page outlines sit
 * at 1150, above the top bar and under any drawer or dialog; outlines for
 * anything inside a modal (side panel, dialog, popover) go on a layer above everything.
 */
const PAGE_Z = '1150';
const OVERLAY_Z = '2147483000';
// Modal surfaces only: a temporary drawer (the SDK side panel), a dialog or a
// popover all render in a .MuiModal-root. Flow's left sidebar is a permanent
// Drawer, which is not modal, so it stays on the page layer.
const OVER_PAGE = '.MuiModal-root, [role="dialog"]';

type Listener = (on: boolean) => void;

let on = false;
let frame = 0;
const layers: Record<'page' | 'over', HTMLDivElement | null> = {
  page: null,
  over: null,
};
const listeners = new Set<Listener>();

/** What the label says: the zone for an extension, the kind otherwise. */
function labelFor(el: Element): string {
  const zone = el.getAttribute('data-zone');
  if (zone) return zone;
  const testId = el.getAttribute('data-testid') ?? '';
  if (testId.startsWith('nav-item-')) return 'menu';
  if (testId.startsWith(PANEL_PREFIX)) return 'side panel';
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

function ensureLayer(which: 'page' | 'over'): HTMLDivElement {
  const existing = layers[which];
  if (existing && document.body.contains(existing)) return existing;
  const layer = document.createElement('div');
  layer.id = `${LAYER_ID}-${which}`;
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: which === 'page' ? PAGE_Z : OVERLAY_Z,
  });
  document.body.appendChild(layer);
  layers[which] = layer;
  return layer;
}

function draw() {
  const seen = new Set<string>();
  const boxes: Record<'page' | 'over', HTMLElement[]> = { page: [], over: [] };
  document.querySelectorAll(MARKER).forEach((marked) => {
    const testId = marked.getAttribute('data-testid') ?? '';
    if (testId === SELF_TEST_ID) return;
    // A full page is outlined once, as a page: the app's own page is all SDK,
    // so callouts for every marked piece inside it are noise.
    const page = marked.parentElement?.closest(
      '[data-testid^="sdk-demo-page-"]',
    );
    if (page) return;
    // Side-panel content: outline the whole drawer, title bar included. A
    // widget: the host's card frame around it (`…-frame` / `…-leaf-frame`),
    // so the outline takes in the title the host draws.
    const el = testId.startsWith(PANEL_PREFIX)
      ? (marked.closest('.MuiDrawer-paper') ?? marked)
      : testId.startsWith('sdk-demo-widget-')
        ? (marked.closest('[data-testid$="-frame"]') ?? marked)
        : marked;
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
      tag.textContent = labelFor(marked);
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
    boxes[el.closest(OVER_PAGE) ? 'over' : 'page'].push(box);
  });
  ensureLayer('page').replaceChildren(...boxes.page);
  ensureLayer('over').replaceChildren(...boxes.over);
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
    layers.page?.remove();
    layers.over?.remove();
    layers.page = null;
    layers.over = null;
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
