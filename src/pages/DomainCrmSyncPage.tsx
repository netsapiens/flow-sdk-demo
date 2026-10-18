/**
 * CRM Sync — a **domain-scoped** full page, registered once under the host's
 * `/manage/:domain` outlet and mounted under whichever domain the admin has
 * drilled into (→ `/manage/acme.example.com/crm-sync`).
 *
 * What it demonstrates:
 *
 *   - ONE registration, not one per domain. The app never enumerates domains and
 *     never names one. `:domain` is a token the host fills from the URL; a
 *     Reseller with 400 domains still registers this page exactly once.
 *   - `useManagingDomain()` is the source of truth for which domain the page is
 *     about — NOT `user.domain`, which is the domain the *signed-in admin*
 *     belongs to and never changes as they drill around. The page states both.
 *   - A native list page: `templates.DatagridTemplate` supplies search, filter,
 *     columns, export, refresh and paging; a row opens the host's side panel
 *     with that user's CRM record.
 *
 * The read asks only for the four fields the page shows, so a large domain does
 * not send every user's whole record.
 *
 * ⚠️ KNOWN SDK BUG (flow-sdk 0.3.7): a domain switch made while this page is not
 * mounted is not seen when it next mounts — `useManagingDomain()` starts from
 * the snapshot taken at app load. Reported to the SDK; deliberately not worked
 * around here, so the fix shows when it lands.
 *
 * CRM linkage is mock data, and linking or unlinking is kept in page state.
 */
import type { DatagridAction, DatagridColumn } from '@netsapiens/flow-sdk';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useFlowContext,
  useManagingDomain,
  useSidePanel,
} from '@netsapiens/flow-sdk';

import type { CrmRecord } from '../mocks/crm';
import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { MOCK_CRM_DIRECTORY } from '../mocks/crm';
import { CrmRecordPanel } from '../panels/CrmRecordPanel';

/** One row of the sync table: a domain user and their CRM linkage. */
interface SyncRow {
  /** The v2 user id, unique within the domain. */
  userId: string;
  displayName: string;
  extension: string;
  /** Present when this user is linked to a CRM account. */
  record?: CrmRecord;
  /** For the grid's filter and export: 'Linked' | 'Not linked'. */
  status: 'Linked' | 'Not linked';
}

/** The subset of the v2 user record this page reads. */
interface NetSapiensUser {
  user?: string;
  'name-first-name'?: string;
  'name-last-name'?: string;
  extension?: string;
}

/** Only what the page shows. */
const USER_FIELDS = 'user,name-first-name,name-last-name,extension';

/** A seat as fetched, before the CRM linkage is applied. */
interface Seat {
  userId: string;
  displayName: string;
  extension: string;
}

/**
 * Sample seats, used when the live fetch fails or the domain has no users. The
 * page says "sample data" above the grid so nobody reads them as real.
 */
const SAMPLE_SEATS: Seat[] = [
  { userId: '1001', displayName: 'Dana Whitfield', extension: '1001' },
  { userId: '1002', displayName: 'Marcus Reyes', extension: '1002' },
  { userId: '1003', displayName: 'Priya Raman', extension: '1003' },
  { userId: '1004', displayName: 'Sam Okafor', extension: '1004' },
];

/**
 * The `/users` feed also carries pseudo-users — the domain itself, each site,
 * each department, each call queue — which hold scope but are not people. They
 * come back with a non-numeric `extension` (`site`, `department`, `domain`), so
 * that is the discriminator: a real seat always has a numeric extension.
 */
function isRealSeat(extension: string): boolean {
  return /^\d+$/.test(extension);
}

const CRM_RECORDS: CrmRecord[] = Object.values(MOCK_CRM_DIRECTORY);

/**
 * Fake the CRM account for a seat. A real integration would query the vendor
 * by email or phone; the demo hashes the extension into the mock directory so
 * the same user always resolves the same way.
 */
function recordFor(extension: string): CrmRecord | undefined {
  if (CRM_RECORDS.length === 0) return undefined;
  const digits = Number(extension.replace(/\D/g, '')) || 0;
  return CRM_RECORDS[digits % CRM_RECORDS.length];
}

/** Roughly half the seats start linked, the same half every time. */
function linkedByDefault(extension: string): boolean {
  const digits = Number(extension.replace(/\D/g, '')) || 0;
  return digits % 2 === 0;
}

const getRowId = (row: SyncRow) => row.userId;
const PAGE_SIZE_OPTIONS = [15, 25, 50, 100];

export default function DomainCrmSyncPage({ ...marker }: ZoneMarkerProps) {
  // The domain the admin drilled INTO. Reactive — it changes under the page.
  const { managing } = useManagingDomain();
  // `user.domain` is the admin's OWN domain and is shown only for contrast.
  const { api, ui, user } = useFlowContext();
  const { open } = useSidePanel();

  const [seats, setSeats] = useState<Seat[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /** Link/unlink choices made on this page, by user id. */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // `undefined` means the host is too old to report a managed domain;
    // `null` means this surface is not domain-scoped. Neither can be fetched.
    if (!managing || !api) return;

    let cancelled = false;
    setLoading(true);
    setLiveError(null);
    setOverrides({});

    api
      .get<NetSapiensUser[]>(`/domains/${managing}/users`, {
        fields: USER_FIELDS,
      })
      .then((users) => {
        if (cancelled) return;
        const mapped = (users ?? []).flatMap((u): Seat[] => {
          const userId = u.user;
          if (!userId) return [];
          const extension = u.extension ?? userId;
          if (!isRealSeat(extension)) return [];
          const name = [u['name-first-name'], u['name-last-name']]
            .filter(Boolean)
            .join(' ');
          return [{ userId, displayName: name || userId, extension }];
        });
        // An empty domain is a legitimate answer, but a blank page reads as a
        // failure — fall back so the demo always shows the shape of the data.
        setIsLive(mapped.length > 0);
        setSeats(mapped.length > 0 ? mapped : SAMPLE_SEATS);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLiveError(error instanceof Error ? error.message : String(error));
        setIsLive(false);
        setSeats(SAMPLE_SEATS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [managing, api, reloadKey]);

  const rows = useMemo<SyncRow[]>(
    () =>
      seats.map((seat) => {
        const linked =
          overrides[seat.userId] ?? linkedByDefault(seat.extension);
        return {
          ...seat,
          record: linked ? recordFor(seat.extension) : undefined,
          status: linked ? 'Linked' : 'Not linked',
        };
      }),
    [seats, overrides],
  );
  const linkedCount = rows.filter((r) => r.record).length;

  const toggleLink = useCallback((row: SyncRow) => {
    setOverrides((prev) => ({ ...prev, [row.userId]: !row.record }));
  }, []);

  const openRecord = useCallback(
    (row: SyncRow) =>
      open({
        title: 'CRM record',
        subtitle: row.displayName,
        width: 'sm',
        icon: 'mdi:card-account-details-outline',
        component: (props) => (
          <CrmRecordPanel
            {...props}
            row={row}
            onToggleLink={() => toggleLink(row)}
          />
        ),
      }),
    [open, toggleLink],
  );

  const { Chip } = ui ?? {};
  const columns = useMemo<DatagridColumn<SyncRow>[]>(
    () => [
      { field: 'displayName', headerName: 'Name', flex: 1, minWidth: 180 },
      { field: 'extension', headerName: 'Extension', width: 120 },
      {
        field: 'status',
        headerName: 'CRM',
        type: 'singleSelect',
        valueOptions: ['Linked', 'Not linked'],
        width: 220,
        // Export and filtering read the plain value; the cell shows the account.
        renderCell: ({ row }: { row: SyncRow }) =>
          Chip ? (
            <Chip
              size='small'
              label={row.record?.company ?? 'Not linked'}
              color={row.record ? 'primary' : 'default'}
              variant={row.record ? 'filled' : 'outlined'}
            />
          ) : (
            (row.record?.company ?? 'Not linked')
          ),
      },
    ],
    [Chip],
  );

  const actions = useMemo<DatagridAction<SyncRow>[]>(
    () => [
      {
        label: 'View CRM record',
        icon: 'mdi:card-account-details-outline',
        onClick: openRecord,
      },
      {
        label: 'Link or unlink',
        icon: 'mdi:link-variant',
        onClick: toggleLink,
      },
    ],
    [openRecord, toggleLink],
  );

  const handleRefresh = useCallback(() => setReloadKey((k) => k + 1), []);
  const toolbar = useMemo(
    () => ({
      enableSearch: true,
      searchPlaceholder: 'Search name or extension…',
      enableFilter: true,
      enableColumns: true,
      enableExport: true,
      exportFilename: `crm-sync-${managing ?? 'domain'}`,
      enableRefresh: true,
      onRefresh: handleRefresh,
      refreshing: loading,
    }),
    [managing, handleRefresh, loading],
  );

  const handleRowClick = useCallback(
    ({ row }: { row: SyncRow }) => openRecord(row),
    [openRecord],
  );

  const { PageTemplate, DatagridTemplate } = ui?.templates ?? {};
  const { Alert } = ui ?? {};

  if (!PageTemplate || !DatagridTemplate) {
    return (
      <div {...marker} style={{ padding: 24 }}>
        UI components not available
      </div>
    );
  }

  return (
    <PageTemplate
      layout='fill'
      {...marker}
      title='CRM Sync'
      subtitle={`${linkedCount} of ${rows.length} users linked to the CRM`}
      breadcrumbs={[
        { label: 'Manage', url: '/manage' },
        { label: managing ?? 'Domain' },
        { label: 'CRM Sync' },
      ]}
      headerStatus={
        Chip ? (
          <Chip
            size='small'
            label={isLive ? 'live data' : 'sample data'}
            color={isLive ? 'success' : 'default'}
          />
        ) : undefined
      }
    >
      {Alert ? (
        <Alert severity={liveError ? 'warning' : 'info'}>
          {liveError
            ? `Could not read users for ${managing}: ${liveError}. Showing sample data instead.`
            : `Users of ${managing ?? 'the selected domain'}, the domain being managed. You signed in against ${user.domain}; this page follows the domain you pick, not your own. Click a row for its CRM record.`}
        </Alert>
      ) : null}

      <DatagridTemplate
        data={rows}
        getRowId={getRowId}
        columns={columns}
        actions={actions}
        toolbar={toolbar}
        loading={loading}
        onRowClick={handleRowClick}
        defaultPageSize={25}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </PageTemplate>
  );
}
