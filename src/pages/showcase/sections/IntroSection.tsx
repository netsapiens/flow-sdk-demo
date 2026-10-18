/**
 * The opening panel of the Component Showcase.
 *
 * Everything below it is a component. This is the part that explains why there
 * is a component kit at all, which is the question a partner developer actually
 * arrives with: they already have a component library, so what does taking ours
 * buy them?
 */
import { useFlowContext, useLocale } from '@netsapiens/flow-sdk';

import { SHOWCASE_TEXT } from '../../../content/i18n/showcase';
import { LOCALIZATION_ANCHOR } from '../../../content/showcaseLocalization';
import { useAppText } from '../../../i18n/useAppText';
import { useShowCode } from '../ShowCode';

/**
 * Host keys shown live on the first screen, so a reader who switches language
 * sees this page answer before they have scrolled at all. Everyday verbs, on
 * purpose: they are the strings an app most often re-translates by hand.
 */
const SAMPLE_KEYS = ['SAVE', 'CANCEL', 'DELETE', 'EXPORT', 'FILTER'];

export default function IntroSection() {
  const { ui } = useFlowContext();
  const { Typography, Paper, Box, Stack, Divider, Icon, Chip, Code, Alert } =
    ui || {};
  const { t } = useLocale();
  const text = useAppText(SHOWCASE_TEXT).intro;
  const showCode = useShowCode();
  if (!Paper || !Typography || !Box || !Stack) return null;

  return (
    <Paper rounded>
      <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1 }}>
        <Typography variant='h4'>{text.title}</Typography>
        {Chip ? (
          <Chip size='small' color='primary' label='flowContext.ui' />
        ) : null}
      </Stack>
      <Typography variant='body1' color='text.secondary' sx={{ mb: 3 }}>
        {text.lead}
      </Typography>

      {/* Localization, up front, showing both sources at once: the sentence is
          this app's own copy (its dictionaries, picked by locale), the chips
          are Flow's words (t(KEY)). Both follow the language switch. */}
      {Alert ? (
        <Alert
          severity='info'
          icon={Icon ? <Icon icon='mdi:translate' /> : undefined}
          sx={{ mb: 3 }}
          // A descriptor, not a node: the kit's Alert draws the button itself,
          // in the house style, and its label is a host string like the chips.
          action={{
            label: t?.('LOCALIZATION') ?? 'Localization',
            onClick: () =>
              document
                .getElementById(LOCALIZATION_ANCHOR)
                ?.scrollIntoView({ behavior: 'smooth' }),
          }}
        >
          <Typography variant='body2' sx={{ mb: Chip ? 1 : 0 }}>
            {text.localizationBefore}{' '}
            {/* The picker's own label, which Flow does not translate. */}
            <strong>Debug Mode (Keys Only)</strong> {text.localizationAfter}
          </Typography>
          {Chip ? (
            <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
              {SAMPLE_KEYS.map((key) => (
                <Chip
                  key={key}
                  size='small'
                  variant='outlined'
                  label={t?.(key) ?? key}
                />
              ))}
            </Stack>
          ) : null}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 2.5,
          mb: 3,
        }}
      >
        {text.points.map((p) => (
          <Stack key={p.title} direction='row' spacing={1.5}>
            {Icon ? (
              <Icon
                icon={p.icon}
                sx={{ fontSize: 22, color: 'primary.main', mt: 0.25 }}
              />
            ) : null}
            <Stack direction='column' spacing={0.5}>
              <Typography variant='subtitle2'>{p.title}</Typography>
              <Typography variant='body2' color='text.secondary'>
                {p.body}
              </Typography>
            </Stack>
          </Stack>
        ))}
      </Box>

      {showCode ? (
        <>
          {Divider && <Divider sx={{ my: 3 }} />}
          <Typography variant='subtitle1' gutterBottom>
            {text.apiTitle}
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            {text.apiBody}
          </Typography>
          {Code ? (
            <Code>
              {`import { useFlowContext } from '@netsapiens/flow-sdk';

function MyPanel() {
  const { ui, theme, t } = useFlowContext();
  const { Paper, Typography, Button } = ui || {};

  // Always guard — an older host may not have every component yet.
  if (!Paper || !Typography || !Button) return null;

  return (
    <Paper>
      {/* Colours are palette PATHS the host resolves at render,
          which is what makes the dark/light toggle work. */}
      <Typography variant="h6" color="text.primary">{t('title')}</Typography>
      <Button variant="contained" onClick={run}>Sync now</Button>
    </Paper>
  );
}`}
            </Code>
          ) : null}
        </>
      ) : null}

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 2, display: 'block' }}
      >
        {text.tip}
      </Typography>
    </Paper>
  );
}
