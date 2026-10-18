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

import {
  LOCALIZATION_ANCHOR,
  SHOWCASE_KEYS,
} from '../../../content/showcaseLocalization';
import { SectionCode } from '../SectionCode';

export default function TypographySection() {
  const { ui } = useFlowContext();
  const {
    Typography,
    Stack,
    Paper,
    Chip,
    Divider,
    Alert,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
  } = ui || {};
  // Reactive: both update the moment the user switches language in the top bar,
  // with nothing to subscribe to here.
  const { t, locale } = useLocale();
  const hasTable = Table && TableHead && TableBody && TableRow && TableCell;

  if (!Paper || !Typography || !Stack) return null;

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

      <Stack
        id={LOCALIZATION_ANCHOR}
        direction='row'
        spacing={1}
        alignItems='center'
        sx={{ mb: 1, scrollMarginTop: 80 }}
      >
        <Typography variant='subtitle1'>
          {t?.('LOCALIZATION') ?? 'Localization'}
        </Typography>
        {Chip ? (
          <Chip size='small' color='primary' label={`locale: ${locale}`} />
        ) : null}
      </Stack>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
        The host hands your app its own translation function, already
        initialised and already holding every string the platform ships — over
        ten thousand keys in its common namespace alone. No i18next dependency,
        no bundle, no init.
      </Typography>

      {Alert ? (
        <Alert severity='info' sx={{ mb: 2 }}>
          <strong>Try it:</strong> pick another language from the flag in the
          top bar and the right-hand column changes under you, with no reload.
          Then pick <strong>Debug Mode (Keys Only)</strong> from the same menu:
          every string the platform translates turns into its key, so whatever
          is still English on this page — headings, prose, these notes — is copy
          this app wrote for itself.
        </Alert>
      ) : null}

      {/* The live table. Column one is the literal key; column two is the very
          same call an app would make, rendered as the host answers it right now.
          The header reuses host keys too, so the table is localized end to end
          — the `t(KEY)` header is code, and stays code in every language. */}
      {hasTable ? (
        <Table size='small' sx={{ mb: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell>{t?.('KEY') ?? 'Key'}</TableCell>
              <TableCell>
                <code>t(KEY)</code>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {SHOWCASE_KEYS.map(({ key, options }) => (
              <TableRow key={key}>
                <TableCell>
                  <code>
                    {options
                      ? `${key}, ${JSON.stringify(options).replace(/"/g, '')}`
                      : key}
                  </code>
                </TableCell>
                <TableCell>{t?.(key, options) ?? key}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <SectionCode>
        {`const { Typography } = flowContext.ui;

<Typography variant="h4">Heading 4</Typography>          // h4 · h5 · h6
<Typography variant="subtitle1">Subtitle 1</Typography>  // subtitle1 · subtitle2
<Typography variant="body1">Body text</Typography>       // body1 · body2
<Typography variant="caption" color="text.secondary">Caption</Typography>

// ── Localization ───────────────────────────────────────────────────────
import { useLocale } from '@netsapiens/flow-sdk';

const { t, locale } = useLocale();   // both reactive; nothing to subscribe to

t('SAVE')                                              // "Save" · "Guardar" · "Sauvegarder"
t('PAGINATION_RANGE', { from: 1, to: 25, count: 148 }) // "1-25 out of 148"

// t is optional on the context — an older host may not supply it — so give
// the English as the fallback rather than rendering "undefined":
<Button>{t?.('SAVE') ?? 'Save'}</Button>
<Switch label={t?.('ENABLED') ?? 'Enabled'} />

// That fallback does NOT catch a wrong key. The host returns a missing key
// as itself, so t('NOT_A_KEY') renders "NOT_A_KEY". Look a key up in the
// host's en-US strings before you use it.

// The table above, in full:
const { Table, TableHead, TableBody, TableRow, TableCell } = flowContext.ui;

<Table size="small">
  <TableHead>
    <TableRow>
      <TableCell>{t?.('KEY') ?? 'Key'}</TableCell>
      <TableCell><code>t(KEY)</code></TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    {KEYS.map(({ key, options }) => (
      <TableRow key={key}>
        <TableCell><code>{key}</code></TableCell>
        <TableCell>{t?.(key, options) ?? key}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>`}
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
