/**
 * CRM Sync — a **domain-scoped** full page, registered once under the host's
 * `/manage/:domain` outlet and mounted under whichever domain the admin has
 * drilled into (→ `/manage/acme.example.com/crm-sync`).
 *
 * This is the page that proves the domain-scoped contract, so it is worth being
 * precise about what is being demonstrated:
 *
 *   - ONE registration, not one per domain. The app never enumerates domains and
 *     never names one. `:domain` is a token the host fills from the URL; a
 *     Reseller with 400 domains still registers this page exactly once.
 *   - `useManagingDomain()` is the source of truth for which domain the page is
 *     about — NOT `user.domain`, which is the domain the *signed-in admin*
 *     belongs to and never changes as they drill around. Getting these two
 *     confused is the whole reason the hook exists, so the page prints both
 *     side by side.
 *   - It is reactive. Switching domains in the host re-broadcasts
 *     `domain:changed`, the hook re-renders, and the effect below re-fetches —
 *     no remount required, and no page reload.
 *
 * The work the page does is deliberately domain-shaped: it reads the selected
 * domain's users from the v2 API through `flowContext.api` and reports which
 * of them are linked to the (mock) vendor CRM. Change the domain, and every
 * number on the page changes with it.
 *
 * As elsewhere in this demo, a failed or empty live fetch falls back to sample
 * data so the page is never blank while you are looking at it.
 */
import { useEffect, useMemo, useState } from 'react';
import { useFlowContext, useManagingDomain } from '@netsapiens/flow-sdk';

import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { MOCK_CRM_DIRECTORY } from '../mocks/crm';

/** One row of the sync table: a domain user and their CRM linkage. */
interface SyncRow {
  /** The v2 user id, unique within the domain. */
  userId: string;
  displayName: string;
  extension: string;
  /** Present when this user matched a record in the vendor CRM. */
  crmCompany?: string;
  source: 'live' | 'sample';
}

/** The subset of the v2 user record this page reads. */
interface NetSapiensUser {
  user?: string;
  'name-first-name'?: string;
  'name-last-name'?: string;
  extension?: string;
}

/**
 * Sample rows, used when the live fetch fails or the domain has no users. They
 * are labelled `sample` in the UI so a reader is never misled into thinking
 * they are looking at real data for the domain they selected.
 */
const SAMPLE_ROWS: SyncRow[] = [
  {
    userId: '1001',
    displayName: 'Dana Whitfield',
    extension: '1001',
    crmCompany: 'Northwind Retail',
    source: 'sample',
  },
  {
    userId: '1002',
    displayName: 'Marcus Reyes',
    extension: '1002',
    crmCompany: 'Contoso Freight',
    source: 'sample',
  },
  {
    userId: '1003',
    displayName: 'Priya Raman',
    extension: '1003',
    source: 'sample',
  },
  {
    userId: '1004',
    displayName: 'Sam Okafor',
    extension: '1004',
    source: 'sample',
  },
];

/**
 * The `/users` feed also carries pseudo-users — the domain itself, each site,
 * each department, each call queue — which hold scope but are not people. They
 * come back with a non-numeric `extension` (`site`, `department`, `domain`), so
 * that is the discriminator: a real seat always has a numeric extension.
 * Without this the page lists "site Site · ext site" as a person to sync.
 */
function isRealSeat(extension: string): boolean {
  return /^\d+$/.test(extension);
}

/**
 * Fake the CRM linkage. A real integration would query the vendor by email or
 * phone; the demo hashes the extension into the mock directory so the same user
 * always resolves the same way, and roughly half of them match.
 */
function crmCompanyFor(extension: string): string | undefined {
  const companies = Object.values(MOCK_CRM_DIRECTORY).map((r) => r.company);
  if (companies.length === 0) return undefined;
  const digits = Number(extension.replace(/\D/g, '')) || 0;
  if (digits % 2 === 1) return undefined;
  return companies[digits % companies.length];
}

export default function DomainCrmSyncPage({ ...marker }: ZoneMarkerProps) {
  // The domain the admin drilled INTO. Reactive — it changes under the page.
  const { managing } = useManagingDomain();
  // `user.domain` is the admin's OWN domain and is shown only for contrast.
  const { api, ui, user } = useFlowContext();

  const [rows, setRows] = useState<SyncRow[]>(SAMPLE_ROWS);
  const [loading, setLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    // `undefined` means the host is too old to report a managed domain;
    // `null` means this surface is not domain-scoped. Neither can be fetched.
    if (!managing || !api) return;

    let cancelled = false;
    setLoading(true);
    setLiveError(null);

    api
      .get<NetSapiensUser[]>(`/domains/${managing}/users`)
      .then((users) => {
        if (cancelled) return;
        const mapped = (users ?? [])
          .map((u): SyncRow | null => {
            const userId = u.user;
            if (!userId) return null;
            const extension = u.extension ?? userId;
            if (!isRealSeat(extension)) return null;
            const name = [u['name-first-name'], u['name-last-name']]
              .filter(Boolean)
              .join(' ');
            return {
              userId,
              displayName: name || userId,
              extension,
              crmCompany: crmCompanyFor(extension),
              source: 'live',
            };
          })
          .filter((r): r is SyncRow => r !== null);

        // An empty domain is a legitimate answer, but a blank page reads as a
        // failure — fall back so the demo always shows the shape of the data.
        setRows(mapped.length > 0 ? mapped : SAMPLE_ROWS);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLiveError(error instanceof Error ? error.message : String(error));
        setRows(SAMPLE_ROWS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [managing, api]);

  const linked = useMemo(() => rows.filter((r) => r.crmCompany).length, [rows]);
  const isLive = rows.some((r) => r.source === 'live');

  const { PageTemplate } = ui?.templates || {};
  const { Paper, Stack, Typography, Chip, Alert } = ui || {};

  if (!PageTemplate || !Paper || !Stack || !Typography) {
    return (
      <div {...marker} style={{ padding: 24 }}>
        UI components not available
      </div>
    );
  }

  return (
    <PageTemplate
      {...marker}
      title='CRM Sync'
      breadcrumbs={[
        { label: 'Manage', url: '/manage' },
        { label: managing ?? 'Domain' },
        { label: 'CRM Sync' },
      ]}
    >
      <Stack spacing={3}>
        {/*
          The contract, stated on screen. Anyone evaluating the SDK can read
          this pane and see that the page followed the domain they picked
          without the app ever naming it.
        */}
        <Paper rounded sx={{ p: 3 }}>
          <Stack spacing={1}>
            <Typography variant='h6'>Domain being managed</Typography>
            <Stack direction='row' spacing={1} alignItems='center'>
              <Typography variant='body1'>
                <strong>{managing ?? 'None selected'}</strong>
              </Typography>
              {Chip ? (
                <Chip
                  size='small'
                  label={isLive ? 'live data' : 'sample data'}
                  color={isLive ? 'success' : 'default'}
                />
              ) : null}
            </Stack>
            <Typography variant='body2' color='text.secondary'>
              Signed in against {user.domain} — this page is scoped to the
              domain selected above, not to the account you signed in with.
              Switch domains and these numbers follow.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Registered once as <code>/manage/:domain/crm-sync</code>.
            </Typography>
          </Stack>
        </Paper>

        {liveError && Alert ? (
          <Alert severity='warning'>
            Could not read users for {managing}: {liveError}. Showing sample
            data instead.
          </Alert>
        ) : null}

        <Paper rounded sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack
              direction='row'
              spacing={2}
              alignItems='center'
              justifyContent='space-between'
            >
              <Typography variant='h6'>CRM linkage</Typography>
              <Typography variant='body2' color='text.secondary'>
                {loading
                  ? 'Loading…'
                  : `${linked} of ${rows.length} users linked`}
              </Typography>
            </Stack>

            {rows.map((row) => (
              <Stack
                key={row.userId}
                direction='row'
                spacing={2}
                alignItems='center'
                justifyContent='space-between'
              >
                <Typography variant='body2'>
                  {row.displayName} · ext {row.extension}
                </Typography>
                {Chip ? (
                  <Chip
                    size='small'
                    label={row.crmCompany ?? 'Not linked'}
                    color={row.crmCompany ? 'primary' : 'default'}
                    variant={row.crmCompany ? 'filled' : 'outlined'}
                  />
                ) : (
                  <Typography variant='body2'>
                    {row.crmCompany ?? 'Not linked'}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Stack>
    </PageTemplate>
  );
}
