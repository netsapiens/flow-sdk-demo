/**
 * Demo app links — a `kind: 'panel'` widget in the **other** category.
 *
 * Registered in `App.tsx` §4. It exists to cover the two things the other
 * widgets in `src/widgets/` do not:
 *
 * - **No `refreshPolicy` at all.** Not every widget has data that goes stale.
 *   Declaring one it does not need would be a lie the host acts on: it would
 *   hand this card `widget.range` and invite it to depend on a dashboard control
 *   that has nothing to do with what it shows.
 * - **`category: 'other'`**, the fallback bucket — and, with it, the last of the
 *   five loading wireframes the host draws from the category.
 *
 * What it actually does is the part worth copying: a widget is a first-class
 * place to drive a host capability, not just to display numbers. This one opens
 * the shared side panel with the app's own content, exactly as the topbar Help
 * button does, and it reads `context.route` — a widget knows where it is
 * rendering, and on a domain-scoped dashboard `context.managing` tells it which
 * domain is on screen.
 */
import type { WidgetComponentProps } from '@netsapiens/flow-sdk';
import { useSidePanel } from '@netsapiens/flow-sdk';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { QuickLinksPanel } from '../panels/QuickLinksPanel';

/** The pages this app registers, as the reader would find them in the menus. */
const PAGES: ReadonlyArray<{ label: string; path: string; menu: string }> = [
  { label: 'Flow SDK Demo', path: '/apps/flow-sdk-demo', menu: 'Apps' },
  {
    label: 'Component Showcase',
    path: '/apps/component-showcase',
    menu: 'Apps',
  },
  { label: 'CRM Integration', path: '/manage/crm-integration', menu: 'Manage' },
  {
    label: 'Call Recordings',
    path: '/home/call-recordings',
    menu: 'My Account',
  },
];

export function PartnerLinksWidget({
  context,
  ...marker
}: WidgetComponentProps & ZoneMarkerProps) {
  const { Stack, Typography, Button, Divider, Code } = context.ui ?? {};
  const navigate = context.navigate;

  // Pass `context.eventBus`: a widget renders outside FlowContextProvider,
  // exactly as a zone extension does, so the hook has no context to read.
  const { open } = useSidePanel(context.eventBus);

  // Carve-out: with no kit there is nothing to render but the list.
  if (!Stack || !Typography) {
    return <div {...marker}>{PAGES.length} demo pages</div>;
  }

  return (
    // No card and no heading — `chrome` is left at its default, so the frame
    // drew both from the registration's `title`.
    <Stack {...marker} direction='column' spacing={1} sx={{ height: '100%' }}>
      <Stack
        direction='column'
        spacing={0.5}
        sx={{ flexGrow: 1, minHeight: 0 }}
      >
        {PAGES.map((page) =>
          navigate && Button ? (
            // A real link. `variant='text'` with the label left-aligned keeps
            // the row reading as a list rather than a stack of buttons, while
            // the kit supplies the focus ring and the hover state.
            <Button
              key={page.path}
              size='small'
              variant='text'
              onClick={() => navigate(page.path)}
              sx={{
                justifyContent: 'space-between',
                px: 0,
                textTransform: 'none',
              }}
            >
              <Typography variant='body2' noWrap sx={{ minWidth: 0 }}>
                {page.label}
              </Typography>
              <Typography variant='caption' color='text.secondary' noWrap>
                {page.menu}
              </Typography>
            </Button>
          ) : (
            // No navigate on this host: show the path rather than a dead control.
            <Stack
              key={page.path}
              direction='row'
              spacing={1}
              alignItems='baseline'
              justifyContent='space-between'
            >
              <Typography variant='body2' noWrap sx={{ minWidth: 0 }}>
                {page.label}
              </Typography>
              <Typography variant='caption' color='text.secondary' noWrap>
                {page.menu} → {page.path}
              </Typography>
            </Stack>
          ),
        )}
      </Stack>

      {Divider ? <Divider /> : null}

      <Stack
        direction='row'
        spacing={1}
        alignItems='center'
        justifyContent='space-between'
        flexWrap='wrap'
        useFlexGap
      >
        {/* A widget knows its route. On `/manage/:domain` surfaces
            `context.managing` names the domain the admin has drilled into. */}
        <Typography variant='caption' color='text.secondary' noWrap>
          {Code ? <Code inline>{context.route}</Code> : context.route}
        </Typography>
        {Button ? (
          <Button
            size='small'
            variant='text'
            onClick={() =>
              open({
                title: 'Help & Quick Links',
                subtitle: 'Opened from a dashboard widget',
                width: 'sm',
                icon: 'material-symbols-light:menu-book-outline-rounded',
                component: QuickLinksPanel,
              })
            }
          >
            Open side panel
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}
