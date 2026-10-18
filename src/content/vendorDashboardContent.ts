/**
 * Card declarations for the Example CRM page (`pages/VendorDashboardPage.tsx`).
 *
 * Kept out of the page for the same reason `demoContent.ts` is: a page file is
 * layout, and everything here is copy plus the layout facts the host needs —
 * title, subtitle, span, reserved height, which cards follow the shared range,
 * and where a number came from. The page pairs each entry with its component by
 * id and passes the list straight to `templates.DashboardTemplate`.
 *
 * Everything in this file is a DECLARATION. There is not a colour, a font size
 * or a padding value anywhere in it, because none of those are an app's to
 * choose — the host draws the card from exactly these fields.
 */

/** One figure inside a card, minus its component. */
export interface VendorDashboardLeaf {
  id: string;
  title: string;
}

/** One card, minus its component(s). `VendorDashboardPage` supplies those. */
export interface VendorDashboardCard {
  id: string;
  title: string;
  description: string;
  size: 'half' | 'full';
  /** Reserved height in grid row units. */
  height: number;
  refreshPolicy?: 'shared-range' | 'realtime' | 'own-cadence';
  metric?: {
    formula?: string;
    source?: string;
    cadence?: string;
    delay?: string;
  };
  /**
   * Figures drawn inside this card on the host's leaf frame, instead of one
   * body. A card declares `leaves` or a component, never both.
   */
  leaves?: VendorDashboardLeaf[];
}

/**
 * The page's layout, in reading order.
 *
 * Ordered the way a dashboard is read rather than by widget kind: the headline
 * chart, then the card of figures it raises questions about, then the detail
 * behind them, then the live board.
 */
export const VENDOR_DASHBOARD_CARDS: VendorDashboardCard[] = [
  {
    id: 'vendor-call-volume',
    title: 'Call volume by CRM match',
    description:
      'Calls whose caller is in Example CRM vs not, across the selected range.',
    size: 'full',
    height: 4,
    refreshPolicy: 'shared-range',
    metric: {
      formula: 'count(calls) by bucket, split by CRM match on the caller',
      source: 'Demo fixture — mocks/widgetActivity.ts',
      cadence: 'On range change',
    },
  },
  // One CARD holding two FIGURES, not two cards.
  //
  // These same two components register on the host's dashboard as `kind: 'leaf'`
  // (App.tsx §4), where the host puts them in a container and draws each one's
  // frame. Declaring them here as `leaves` gets exactly that — the same leaf
  // frame, the same grid breaks, the same square corners — so the pair looks
  // identical whether a reader meets it here or on the host's own dashboard.
  //
  // Declared as two separate cards, which is what this page did before the
  // template understood leaves, they came out as two panels: right numbers,
  // wrong shape, and visibly not the thing the host renders.
  //
  // A leaf only exists inside a card. There is no standalone leaf, deliberately
  // — outside a container it would just be a card with fewer features, which is
  // what `component` already gives you.
  {
    id: 'vendor-sync-health',
    title: 'Sync health',
    description: 'Reconciliation over the last 24 hours.',
    size: 'full',
    height: 3,
    leaves: [
      { id: 'vendor-contacts-synced', title: 'Contacts synced' },
      { id: 'vendor-sync-failures', title: 'Sync failures' },
    ],
  },
  {
    id: 'vendor-sync-outcomes',
    title: 'Sync outcomes',
    description: 'How the queue is currently distributed.',
    size: 'half',
    height: 4,
    metric: {
      formula: 'count(queue_rows) grouped by state',
      source: 'Demo fixture — mocks/syncQueue.ts',
      cadence: 'Snapshot',
    },
  },
  {
    // Paired with the donut deliberately. A row is as tall as its tallest card,
    // so two cards of the same declared height sit level; putting the datagrid
    // here instead dragged the ring to 1016px for a shape that needs 400.
    id: 'vendor-recent-activity',
    title: 'CRM activity',
    description: 'What the integration wrote to Example CRM in this range.',
    size: 'half',
    height: 4,
    refreshPolicy: 'shared-range',
  },
  {
    // Full width and alone on its row: a table with ten rows, a toolbar and a
    // pagination footer wants the space, and nothing should have to match it.
    id: 'vendor-sync-queue',
    title: 'CRM sync queue',
    description: 'Contacts waiting to reconcile with the vendor CRM.',
    size: 'full',
    height: 6,
    // Its own timer, so the page's range control correctly leaves it alone and
    // the frame draws it no window chip.
    refreshPolicy: 'own-cadence',
  },
  {
    id: 'vendor-live-calls',
    title: 'CRM call console',
    description:
      'Your calls in progress as Example CRM accounts, with a note per call.',
    size: 'full',
    height: 5,
    refreshPolicy: 'realtime',
  },
];
