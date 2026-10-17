/**
 * Form Data Inspector Extension
 * Zone: `form-section-after` — below the fields of an add/edit drawer.
 *
 * Shows what a form-section extension is handed: `pageContext` carries
 * `{ formType, mode, entityId, formData }`, and `formData` is the drawer's live
 * values, re-delivered on every keystroke. On the site drawer it picks out the
 * two fields a partner asked for (the site name and its dial plan); on any
 * other form it lists every value.
 *
 * READ-ONLY, BY DESIGN. `formData` is a copy of the values, never the form
 * itself: an extension cannot set, pre-fill or validate a field, or change what
 * is submitted. Assigning to it changes this component's copy and nothing else,
 * so there is no write path to demonstrate. Read it; do not try to steer it.
 */
import { type ExtensionComponentProps } from '@netsapiens/flow-sdk';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';

/**
 * The `pageContext` the host hands the `form-section-before` / `-after` zones.
 * The SDK does not export this shape yet (it does for the table filter bar), so
 * it is declared here.
 */
interface FormSectionContext {
  formType: string;
  mode: 'add' | 'edit';
  entityId?: string | number;
  /** Absent on the few viewer/bulk drawers that hand nothing over. */
  formData?: Record<string, unknown>;
}

/** Long enough to read a value, short enough that a JSON field cannot take over. */
const MAX_VALUE = 80;

/** Rows shown for a generic form; a call queue alone hands over about 40 fields. */
const MAX_ROWS = 12;

function show(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text;
}

export default function FormDataInspector({
  context,
  ...marker
}: ExtensionComponentProps & ZoneMarkerProps) {
  const {
    Paper,
    Stack,
    Typography,
    Chip,
    Alert,
    Table,
    TableBody,
    TableRow,
    TableCell,
  } = context.ui ?? {};
  if (
    !Paper ||
    !Stack ||
    !Typography ||
    !Chip ||
    !Alert ||
    !Table ||
    !TableBody ||
    !TableRow ||
    !TableCell
  )
    return null;

  const page = context.pageContext as FormSectionContext | undefined;
  if (!page) return null;
  const formData = page.formData;
  const entries = formData ? Object.entries(formData) : [];

  return (
    <Paper {...marker} sx={{ width: '100%' }}>
      <Stack spacing={1.5}>
        <Stack
          direction='row'
          spacing={1}
          alignItems='center'
          flexWrap='wrap'
          useFlexGap
        >
          <Typography variant='subtitle1' fontWeight={600}>
            Live form data
          </Typography>
          <Chip size='small' label={page.formType} />
          <Chip
            size='small'
            color={page.mode === 'add' ? 'success' : 'info'}
            label={page.mode}
          />
          {page.entityId !== undefined ? (
            <Chip
              size='small'
              variant='outlined'
              label={String(page.entityId)}
            />
          ) : null}
        </Stack>

        {!formData ? (
          <Alert severity='warning'>
            This form hands extensions no form data.
          </Alert>
        ) : page.formType === 'site' ? (
          // The site drawer: the two values a partner asked to read.
          <Stack spacing={0.5}>
            <Typography variant='body2'>
              Site name: <strong>{show(formData['site'])}</strong>
            </Typography>
            <Typography variant='body2'>
              Dial plan: <strong>{show(formData['dial-plan'])}</strong>
            </Typography>
          </Stack>
        ) : (
          <Table size='small'>
            <TableBody>
              {entries.slice(0, MAX_ROWS).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell sx={{ color: 'text.secondary', width: '40%' }}>
                    {key}
                  </TableCell>
                  <TableCell>{show(value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {page.formType !== 'site' && entries.length > MAX_ROWS ? (
          <Typography variant='caption' color='text.secondary'>
            …and {entries.length - MAX_ROWS} more fields.
          </Typography>
        ) : null}

        <Typography variant='caption' color='text.secondary'>
          Read-only: updates as you type, and nothing here can change what the
          form submits.
        </Typography>
      </Stack>
    </Paper>
  );
}
