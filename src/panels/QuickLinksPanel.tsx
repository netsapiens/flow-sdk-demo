/**
 * Quick Links side-panel content.
 *
 * Opened on demand via the SDK's `useSidePanel()` / `sdk.openSidePanel()` (see
 * TopbarHelpButton). Rendered inside Flow's shared SidePanel drawer, so it
 * receives the host `context` (ui, theme, …) and a `close` callback.
 */
import type { SidePanelContentProps } from '@netsapiens/flow-sdk';

const LINKS = [
  {
    label: 'Reporting guide',
    icon: 'mdi:book-open-variant',
    href: 'https://docs.netsapiens.com/',
  },
  {
    label: 'Call-log glossary',
    icon: 'mdi:format-list-bulleted',
    href: 'https://docs.netsapiens.com/',
  },
  {
    label: 'Contact support',
    icon: 'mdi:lifebuoy',
    href: 'https://docs.netsapiens.com/',
  },
];

export function QuickLinksPanel({ context, close }: SidePanelContentProps) {
  const { Stack, Typography, Divider, Icon, Button } = context.ui ?? {};
  if (!Stack || !Typography) return null;

  return (
    <Stack spacing={2}>
      <Typography variant='body2' color='text.secondary'>
        Handy links and shortcuts, served by the demo app from a shared side
        panel that any page or action can open.
      </Typography>

      {Divider && <Divider />}

      <Stack spacing={1.5}>
        {LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target='_blank'
            rel='noopener noreferrer'
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            <Stack direction='row' spacing={1} alignItems='center'>
              {Icon && <Icon icon={l.icon} sx={{ fontSize: 18 }} />}
              <Typography variant='body2'>{l.label}</Typography>
            </Stack>
          </a>
        ))}
      </Stack>

      {Button && (
        <>
          {Divider && <Divider />}
          <Button variant='text' onClick={close}>
            {context.t?.('CLOSE') ?? 'Close'}
          </Button>
        </>
      )}
    </Stack>
  );
}

export default QuickLinksPanel;
