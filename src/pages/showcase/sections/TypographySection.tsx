/**
 * Showcase section: Typography variants, and the strings that go in them.
 *
 * The two belong together. Every `Typography` on this page renders text, and in
 * a platform that ships in a dozen locales the interesting question is not what
 * the type scale looks like but where the words come from — so the variant ramp
 * is followed by the host's own translation function, resolving real host keys
 * live.
 */
import { useFlowContext, useLocale } from '@netsapiens/flow-sdk';

import { SectionCode } from '../SectionCode';

/**
 * Real keys from the host's `common` namespace, not invented ones.
 *
 * Chosen to make a specific point each: the first four are the everyday verbs
 * any app needs and would otherwise re-translate; `SEARCH_PLACEHOLDER` is one
 * the kit already uses internally; and `PAGINATION_RANGE` takes interpolation
 * values, which is the part people assume they have to hand-roll.
 */
const KEYS: Array<{ key: string; options?: Record<string, unknown> }> = [
  { key: 'SAVE' },
  { key: 'CANCEL' },
  { key: 'DELETE' },
  { key: 'EXPORT' },
  { key: 'SEARCH_PLACEHOLDER' },
  { key: 'PAGINATION_RANGE', options: { from: 1, to: 25, count: 148 } },
];

export default function TypographySection() {
  const { ui } = useFlowContext();
  const { Typography, Stack, Paper, Box, Chip, Divider } = ui || {};
  // Reactive: both update the moment the user switches language in the top bar,
  // with nothing to subscribe to here.
  const { t, locale } = useLocale();

  if (!Paper || !Typography || !Stack || !Box) return null;

  return (
    <Paper rounded>
      <Typography variant='h5' gutterBottom>
        Typography &amp; localization
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
        The type scale, and where the words in it come from.
      </Typography>

      <Stack spacing={2}>
        <Typography variant='h4'>Heading 4</Typography>
        <Typography variant='h5'>Heading 5</Typography>
        <Typography variant='h6'>Heading 6</Typography>
        <Typography variant='subtitle1'>Subtitle 1</Typography>
        <Typography variant='subtitle2'>Subtitle 2</Typography>
        <Typography variant='body1'>Body 1 - Default body text</Typography>
        <Typography variant='body2'>Body 2 - Smaller text</Typography>
        <Typography variant='caption' color='text.secondary'>
          Caption text
        </Typography>
      </Stack>

      {Divider && <Divider sx={{ my: 3 }} />}

      <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1 }}>
        <Typography variant='subtitle1'>
          {t?.('LOCALIZATION') ?? 'Localization'}
        </Typography>
        {Chip ? (
          <Chip size='small' color='primary' label={`locale: ${locale}`} />
        ) : null}
      </Stack>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
        The host hands your app its own translation function, already
        initialised and already holding every string the platform ships —
        thousands of them, across the common, telecom, admin and validation
        namespaces. No i18next dependency, no bundle, no init. Switch language
        in the top bar and the values below change under you.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, max-content) 1fr',
          columnGap: 3,
          rowGap: 1,
          alignItems: 'baseline',
          borderLeft: '2px solid',
          borderColor: 'divider',
          pl: 2,
        }}
      >
        {KEYS.map(({ key, options }) => (
          <Box key={key} sx={{ display: 'contents' }}>
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{ fontFamily: 'monospace' }}
            >
              {options ? `${key}, {…}` : key}
            </Typography>
            <Typography variant='body2'>{t?.(key, options) ?? key}</Typography>
          </Box>
        ))}
      </Box>

      <SectionCode>
        {`const { Typography } = flowContext.ui;

<Typography variant="h4">Heading 4</Typography>          // h4 · h5 · h6
<Typography variant="subtitle1">Subtitle 1</Typography>  // subtitle1 · subtitle2
<Typography variant="body1">Body text</Typography>       // body1 · body2
<Typography variant="caption" color="text.secondary">Caption</Typography>

// ── Localization ───────────────────────────────────────────────────────
import { useLocale } from '@netsapiens/flow-sdk';

const { t, locale } = useLocale();   // both reactive; nothing to subscribe to

t('SAVE')                                             // "Save"
t('PAGINATION_RANGE', { from: 1, to: 25, count: 148 }) // interpolation works

// t is optional on the context — an older host may not supply it — so treat
// the key as the fallback rather than rendering "undefined":
t?.('SAVE') ?? 'Save'`}
      </SectionCode>

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 2, display: 'block' }}
      >
        💡 Reach for a host key before writing your own. Anything the platform
        already says — Save, Cancel, Status, Active — is translated into every
        locale Flow ships and stays that way; a string you hard-code is English
        forever, and reads as English in the middle of a translated page.
      </Typography>
    </Paper>
  );
}
