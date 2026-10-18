/**
 * Example CRM side-panel content — find a contact without leaving Flow.
 *
 * Opened on demand through `useSidePanel()` from the topbar CRM launcher (see
 * `extensions/TopbarCrmButton.tsx`) and from the Demo app links dashboard widget,
 * so the same content shows the panel is reachable from a global entry point and
 * from a widget alike. Rendered inside Flow's shared SidePanel drawer, it gets
 * the host `context` and a `close` callback.
 *
 * Everything on it is the app's, not the host's: a connection line for the
 * app's own integration and a search over its own directory
 * (`MOCK_CRM_DIRECTORY` via `searchCrmDirectory`). Flow has neither, which is
 * why this belongs in an app. It replaced a Quick Links panel of help-centre
 * links, which the host's own Help Center button already covers.
 *
 * Kit-only: the `SearchField` debounces for us, so the filter runs straight
 * from its `onChange`, and results are `List > ListItem > ListItemText`.
 */
import type { SidePanelContentProps } from '@netsapiens/flow-sdk';
import { useState } from 'react';

import { MOCK_CRM_DIRECTORY, searchCrmDirectory } from '../mocks/crm';

/** One icon for "the example CRM", wherever the app opens it from. */
export const CRM_ICON = 'mdi:card-account-details-outline';

const TOTAL = Object.keys(MOCK_CRM_DIRECTORY).length;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function CrmSearchPanel({ context, close }: SidePanelContentProps) {
  const {
    Stack,
    Typography,
    Divider,
    Button,
    Chip,
    SearchField,
    TextField,
    List,
    ListItem,
    ListItemText,
    Avatar,
  } = context.ui ?? {};
  const [query, setQuery] = useState('');

  if (!Stack || !Typography) return null;

  const results = searchCrmDirectory(query);

  return (
    <Stack spacing={2}>
      {/* Connection status. Mock: a real app would report its own backend's
          link to the vendor here, which Flow has no way to know. */}
      <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
        {Chip ? (
          <Chip size='small' color='success' label='Connected' />
        ) : (
          <Typography variant='body2'>Connected</Typography>
        )}
        <Typography variant='body2' color='text.secondary'>
          Example CRM · {TOTAL} contacts · example data
        </Typography>
      </Stack>

      {SearchField ? (
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery('')}
          placeholder='Find a contact in the CRM'
          fullWidth
        />
      ) : TextField ? (
        <TextField
          label='Find a contact in the CRM'
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : null}

      <Typography variant='caption' color='text.secondary'>
        {query.trim()
          ? `${results.length} of ${TOTAL} match “${query.trim()}” by name, company or number`
          : `All ${TOTAL} contacts`}
      </Typography>

      {results.length === 0 ? (
        <Typography variant='body2' color='text.secondary'>
          No contact in the example CRM matches that.
        </Typography>
      ) : List && ListItem && ListItemText ? (
        <List dense disablePadding>
          {results.map(({ key, record }) => (
            <ListItem key={key} disableGutters>
              {Avatar ? (
                <Avatar sx={{ width: 32, height: 32, fontSize: 13, mr: 1.5 }}>
                  {initials(record.name)}
                </Avatar>
              ) : null}
              <ListItemText
                primary={record.name}
                secondary={`${record.company} · ${key} · last contact ${record.lastContact}`}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Stack spacing={1}>
          {results.map(({ key, record }) => (
            <Typography key={key} variant='body2'>
              {record.name} · {record.company} · {key}
            </Typography>
          ))}
        </Stack>
      )}

      {Button && (
        <>
          {Divider && <Divider />}
          <Stack direction='row' spacing={1} justifyContent='flex-end'>
            {/* The CRM's own full view lives on a page this app registers. */}
            {context.navigate ? (
              <Button
                variant='text'
                onClick={() => {
                  close();
                  context.navigate?.('/apps/example-crm');
                }}
              >
                Open Example CRM
              </Button>
            ) : null}
            <Button variant='text' onClick={close}>
              {context.t?.('CLOSE') ?? 'Close'}
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}

export default CrmSearchPanel;
