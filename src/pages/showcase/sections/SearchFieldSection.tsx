/** Showcase section: SearchField and Autocomplete. */
import { useState } from 'react';
import { useFlowContext, useLocale } from '@netsapiens/flow-sdk';

import { SectionCode } from '../SectionCode';

const OPTIONS = [
  { value: 'acme', label: 'Acme Corporation' },
  { value: 'northwind', label: 'Northwind Retail' },
  { value: 'contoso', label: 'Contoso Freight' },
  { value: 'globex', label: 'Globex Industries' },
];

export default function SearchFieldSection() {
  const { ui } = useFlowContext();
  // Host keys for the shared vocabulary: these follow the language switch,
  // and a string hard-coded here would be English forever.
  const { t } = useLocale();
  const { SearchField, Autocomplete, Typography, Stack, Paper } = ui || {};
  const [search, setSearch] = useState('');
  const [choice, setChoice] = useState<string | number | null>('acme');

  if (!Paper || !Typography || !Stack || !SearchField) return null;

  return (
    <Paper rounded>
      <Typography variant='h5' gutterBottom>
        SearchField &amp; Autocomplete
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
        The list-page search input, debounced by the host, and a searchable
        single-select.
      </Typography>

      <Stack direction='column' spacing={2} sx={{ maxWidth: 420 }}>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={t?.('SEARCH_PLACEHOLDER') ?? 'Search…'}
          fullWidth
        />
        {Autocomplete ? (
          <Autocomplete
            source={{ options: OPTIONS }}
            value={choice}
            onChange={setChoice}
            label={t?.('CUSTOMER') ?? 'Customer'}
            fullWidth
          />
        ) : null}
        <Typography variant='caption' color='text.secondary'>
          Search value: <strong>{search || '(empty)'}</strong> · Selected:{' '}
          <strong>{String(choice ?? 'none')}</strong>
        </Typography>
      </Stack>

      <SectionCode>
        {`const { SearchField, Autocomplete } = flowContext.ui;

// Debounced by the host, so onChange fires on settled values — filter or
// fetch straight from it. debounceMs={0} opts out.
<SearchField value={q} onChange={setQ} placeholder="Search domains" />

// Host-backed mode takes YOUR api client, so the read goes through your
// per-app audited proxy and the platform can attribute and rate-limit it:
<Autocomplete source={{ host: 'user', api, domain: user.domain }}
              value={v} onChange={setV} label="User" />

// Or your own data:
<Autocomplete source={{ options }} value={v} onChange={setV} />`}
      </SectionCode>

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 2, display: 'block' }}
      >
        💡 There is deliberately no <code>fetchOptions</code> callback —
        anything beyond the host datasets, you fetch yourself and pass as{' '}
        <code>options</code>.
      </Typography>
    </Paper>
  );
}
