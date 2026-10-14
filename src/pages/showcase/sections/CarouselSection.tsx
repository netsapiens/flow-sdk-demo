/** Showcase section: CarouselTemplate (horizontally-rotating strip). */
import { useFlowContext } from '@netsapiens/flow-sdk';

import { SectionCode } from '../SectionCode';

const FEATURED = [
  {
    icon: 'mdi:rocket-launch',
    name: 'Flow SDK Demo',
    note: 'Every extension surface',
  },
  {
    icon: 'mdi:account-sync',
    name: 'CRM Integration',
    note: 'Live CDRs + contact matching',
  },
  {
    icon: 'mdi:record-rec',
    name: 'Call Recordings',
    note: 'Filterable recording library',
  },
  {
    icon: 'mdi:palette',
    name: 'Component Showcase',
    note: 'The whole host kit',
  },
  {
    icon: 'mdi:chart-line',
    name: 'Call Analytics',
    note: 'Injected below Call Logs',
  },
  {
    icon: 'mdi:shield-check',
    name: 'Compliance',
    note: 'A gated form section',
  },
  {
    icon: 'mdi:download',
    name: 'Export Data',
    note: 'page-header-actions, five routes',
  },
  {
    icon: 'mdi:account-box',
    name: 'Caller Enrichment',
    note: 'Live CRM match on an inbound call',
  },
  {
    icon: 'mdi:priority-high',
    name: 'Priority Column',
    note: 'Merged into the Call Logs grid',
  },
  {
    icon: 'mdi:help-circle',
    name: 'Help Panel',
    note: 'Top bar on every page',
  },
  {
    icon: 'mdi:broadcast',
    name: 'Live Status Badge',
    note: 'Beside the page title',
  },
];

export default function CarouselSection() {
  const { ui } = useFlowContext();
  const { Box, Typography, Stack, Paper, Chip } = ui || {};
  const { CarouselTemplate, Icon } = ui?.templates || {};
  if (!Paper || !Typography || !Stack || !Box || !CarouselTemplate) return null;

  const slide = (item: (typeof FEATURED)[number]) => (
    <Paper
      rounded
      key={item.name}
      variant='outlined'
      sx={{ p: 2, height: '100%' }}
    >
      <Stack spacing={1}>
        {Icon ? <Icon name={item.icon} size={24} /> : null}
        <Typography variant='subtitle2' fontWeight={600}>
          {item.name}
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          {item.note}
        </Typography>
      </Stack>
    </Paper>
  );

  return (
    <Paper rounded>
      <Typography variant='h5' gutterBottom>
        CarouselTemplate
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
        A horizontally-rotating strip. Items are children, so a slide is
        whatever you make it — here each one is an outlined Paper.
      </Typography>

      <Stack spacing={4}>
        <Box>
          <Typography variant='subtitle2' gutterBottom>
            Manual — <code>autoRotate</code> off (the default)
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>
            Nothing moves until you move it. Drive it with the arrows, the dots,
            a trackpad swipe, or the arrow keys once the strip has focus. With{' '}
            {FEATURED.length} slides at{' '}
            <code>itemMinWidth=&#123;240&#125;</code> there are several pages to
            move through at any window width — the control only appears when
            there is actually somewhere to scroll.
          </Typography>
          <CarouselTemplate
            title='Featured apps'
            action={
              Chip ? (
                <Chip label={`${FEATURED.length} apps`} size='small' />
              ) : undefined
            }
            itemMinWidth={240}
            aria-label='Featured apps, manual navigation'
          >
            {FEATURED.map(slide)}
          </CarouselTemplate>
        </Box>

        <Box>
          <Typography variant='subtitle2' gutterBottom>
            Auto-rotating — <code>autoRotate</code> with a 3s dwell
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>
            Advances on its own, and stops the moment you engage: hover it, or
            tab into it, and rotation pauses until you leave. Narrower items (
            <code>itemMinWidth=&#123;180&#125;</code>) fit more per page, so the
            same {FEATURED.length} slides take fewer steps to cycle. If your OS
            is set to reduce motion, this one deliberately will not rotate at
            all — that is the template honouring{' '}
            <code>prefers-reduced-motion</code>, not a bug.
          </Typography>
          <CarouselTemplate
            autoRotate={3000}
            itemMinWidth={180}
            showDots
            aria-label='Featured apps, auto-rotating'
          >
            {FEATURED.map(slide)}
          </CarouselTemplate>
        </Box>
      </Stack>

      <SectionCode>
        {`const { CarouselTemplate } = flowContext.ui.templates;

// Slides are children — one per item, and a slide is whatever you render.
// itemMinWidth (px) drives how many fit per page at each breakpoint.
<CarouselTemplate
  title="Featured apps"
  action={<Chip label={\`\${apps.length} apps\`} size="small" />}
  itemMinWidth={240}
  aria-label="Featured apps"        // REQUIRED — a scrolling region needs a name
>
  {apps.map((app) => (
    <AppCard key={app.id} app={app} />
  ))}
</CarouselTemplate>

// autoRotate: false (default) | true for the default dwell | milliseconds.
// Rotation pauses on hover and on keyboard focus, and prefers-reduced-motion
// disables it outright — so give the user a way through it either way.
<CarouselTemplate autoRotate={3000} showDots showArrows aria-label="Promotions">
  {promos.map((p) => <PromoCard key={p.id} promo={p} />)}
</CarouselTemplate>`}
      </SectionCode>

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 2, display: 'block' }}
      >
        💡 Used in: app galleries, featured/promoted rows, onboarding highlights
        — anywhere a horizontal row beats a vertical list
      </Typography>

      <Typography
        variant='caption'
        color='info.main'
        sx={{ mt: 2, display: 'block' }}
      >
        ♿ <strong>What it handles for you:</strong> auto-rotation pauses on
        hover <em>and</em> on keyboard focus,{' '}
        <code>prefers-reduced-motion</code> disables it outright, and the active
        dot is derived from scroll progress so a partial last page still lights
        the right one. These are the parts that are easy to get wrong and hard
        to catch in review, which is why the strip is a template rather than
        something each app rebuilds.
      </Typography>
    </Paper>
  );
}
