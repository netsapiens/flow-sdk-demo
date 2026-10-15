/**
 * CRM Integration — a full page registered into the host's Manage menu by this
 * remote app (parentPath '/manage', placed after Call Logs), proving the Manage
 * tree can be extended, not just /apps. It does something the host can't do
 * natively: surface a third-party CRM next to the user's NetSapiens telephony
 * data.
 *
 *   - apiProxy  — the recent-call list is fetched live from the NetSapiens v2
 *                 API through flowContext.api; credentials never reach this
 *                 remote app.
 *   - CRM match — selecting a call resolves the caller in the (mock) CRM — the
 *                 same directory that powers the CallerInfoWidget — so the page
 *                 reuses one source of truth.
 *
 * CRM data is mock for now. Authenticating to a real CRM backend on behalf of
 * the Flow user is the remoteAuth flow — demonstrated standalone on the
 * "Remote Auth" tab — and can gate this page's CRM pane later.
 *
 * As with the rest of the demo, the live call falls back to sample data so the
 * page is never empty.
 */
import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useFlowContext, useLocale } from '@netsapiens/flow-sdk';

import type { RecentCall } from '../mocks/recentCalls';
import { fetchRecentCalls } from '../api/callsApi';
import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import { lookupCrmRecord, normalizePhoneNumber } from '../mocks/crm';
import { formatDuration, SAMPLE_RECENT_CALLS } from '../mocks/recentCalls';

const VENDOR_NAME = 'Example CRM';
/**
 * Where the vendor CRM lives. A real integration would deep-link to the matched
 * contact in your CRM; this demo opens an illustrative per-contact URL.
 */
const VENDOR_CRM_BASE_URL = 'https://app.example-crm.example';

/**
 * REAL CRM FETCH (stubbed) — how the "Matched CRM record" pane would be filled
 * from a live CRM instead of the mock directory.
 *
 * The demo resolves records from a static fixture (`lookupCrmRecord`). In a real
 * integration you'd authenticate to the vendor CRM on the Flow user's behalf
 * via the SDK's remoteAuth flow (demonstrated standalone on the "Remote Auth"
 * tab), then call the vendor API with the brokered token. Flow credentials
 * never reach this remote app — only the vendor token does.
 *
 * Uncomment and wire `selectedRecord` to this (in an effect, keyed on the
 * selected call's party) once a vendor backend + callbackUrl exist:
 *
 *   const VENDOR_ID = 'example-crm';
 *
 *   async function fetchCrmRecord(
 *     auth: ReturnType<typeof useFlowContext>['auth'],
 *     phoneNumber: string,
 *   ): Promise<CrmRecord | undefined> {
 *     // 1. Reuse a session-cached vendor token, or broker a new handshake.
 *     //    requestRemoteAuth resolves only after your backend mints the token
 *     //    from the platform's signed, single-use code (see Remote Auth tab).
 *     let token = auth.getRemoteAuthToken(VENDOR_ID);
 *     if (!token) {
 *       token = await auth.requestRemoteAuth(
 *         {
 *           vendorId: VENDOR_ID,
 *           // No callbackUrl: where the webhook goes is registration data,
 *           // set by an administrator in Registered Apps.
 *           scopes: ['contacts:read'],
 *         },
 *         { timeout: 60000 },
 *       );
 *     }
 *
 *     // 2. Call the vendor CRM with the brokered token (RemoteAuthResponse:
 *     //    { vendorId, accessToken, tokenType?, expiresAt?, refreshToken?, ... }).
 *     const res = await fetch(
 *       `${VENDOR_CRM_BASE_URL}/api/contacts/lookup?phone=${encodeURIComponent(phoneNumber)}`,
 *       {
 *         headers: {
 *           Authorization: `${token.tokenType ?? 'Bearer'} ${token.accessToken}`,
 *         },
 *       },
 *     );
 *     if (!res.ok) return undefined; // 404 -> no match -> offer to create contact
 *
 *     // 3. Map the vendor's payload into the card's CrmRecord shape.
 *     const c = await res.json();
 *     return {
 *       name: c.full_name,
 *       company: c.account?.name ?? '',
 *       lastContact: c.last_activity_at ?? '—',
 *       notes: c.notes ?? '',
 *       callCount: c.call_count ?? 0,
 *     };
 *   }
 */

/** How the live CDR fetch resolved — drives the apiProxy status banner. */
type LiveStatus = 'loading' | 'live' | 'empty' | 'error';

export default function CrmIntegrationPage({ ...marker }: ZoneMarkerProps) {
  const flowContext = useFlowContext();
  const { t } = useLocale();
  const { user, api } = flowContext;

  // apiProxy: the signed-in user's recent calls from the NetSapiens v2 API.
  const [liveCalls, setLiveCalls] = useState<RecentCall[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The deep-link the "Open in Example CRM" button reveals (demo doesn't navigate).
  const [deepLink, setDeepLink] = useState<string | null>(null);

  useEffect(() => {
    const userId = user?.extension;
    const domain = user?.domain;
    if (!api || !userId || !domain) {
      setLiveStatus('error');
      return;
    }
    let cancelled = false;
    setLiveStatus('loading');
    fetchRecentCalls(domain, userId, api)
      .then((calls) => {
        if (cancelled) return;
        setLiveCalls(calls);
        setLiveStatus(calls.length > 0 ? 'live' : 'empty');
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(
          '[Demo App] Live call fetch failed — showing sample data.',
          err,
        );
        setLiveStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [api, user?.extension, user?.domain]);

  // Live calls first, then the bundled sample set.
  const allCalls = useMemo<RecentCall[]>(
    () => [...liveCalls, ...SAMPLE_RECENT_CALLS],
    [liveCalls],
  );

  // Default the selection to the first call once the list is known.
  useEffect(() => {
    if (!selectedId && allCalls.length) setSelectedId(allCalls[0].id);
  }, [allCalls, selectedId]);

  // Hide any revealed deep-link when the selected call changes.
  useEffect(() => {
    setDeepLink(null);
  }, [selectedId]);

  const selectedCall = allCalls.find((c) => c.id === selectedId) ?? null;
  // Mock lookup for the demo. A real integration would replace this with the
  // remoteAuth-backed vendor fetch sketched above (`fetchCrmRecord`).
  const selectedRecord = selectedCall
    ? lookupCrmRecord(normalizePhoneNumber(selectedCall.party))
    : undefined;

  const ui = flowContext.ui;
  const { PageTemplate } = ui?.templates || {};
  const { Paper, Stack, Typography, Chip, Alert, Divider, Box, Button } =
    ui || {};

  if (!PageTemplate || !Paper || !Stack || !Typography || !Chip || !Box) {
    return (
      <div {...marker} style={{ padding: 24 }}>
        UI components not available
      </div>
    );
  }

  const callLabel = (c: RecentCall) => {
    const rec = lookupCrmRecord(normalizePhoneNumber(c.party));
    // CRM match wins; otherwise the API's friendly name; otherwise the number.
    return rec?.name ?? c.name ?? c.party;
  };

  return (
    <PageTemplate
      {...marker}
      title={`${VENDOR_NAME} Integration`}
      subtitle="The signed-in user's NetSapiens calls, matched to their CRM record"
      breadcrumbs={[
        { label: t?.('MANAGE') ?? 'Manage', url: '/manage' },
        { label: `${VENDOR_NAME} Integration` },
      ]}
    >
      <Stack spacing={3}>
        {/* apiProxy status banner — the recent-call list is a live v2 API call. */}
        {Alert &&
          (liveStatus === 'live' ? (
            <Alert severity='success'>
              Loaded {liveCalls.length} live call
              {liveCalls.length === 1 ? '' : 's'} for{' '}
              <strong>
                {user?.extension}@{user?.domain}
              </strong>{' '}
              via{' '}
              <code>
                GET /domains/{user?.domain}/users/{user?.extension}/cdrs
              </code>
              . Sample calls are shown alongside them.
            </Alert>
          ) : liveStatus === 'loading' ? (
            <Alert severity='info'>
              Loading recent calls from the NetSapiens v2 API…
            </Alert>
          ) : (
            <Alert severity='info'>
              Showing sample calls. The page still calls{' '}
              <code>
                GET /domains/{'{domain}'}/users/{'{user}'}/cdrs
              </code>{' '}
              through <code>flowContext.api</code> on load.
            </Alert>
          ))}

        {/* Master/detail: recent calls (NetSapiens) ↔ matched CRM record. */}
        <Stack
          direction='row'
          spacing={3}
          flexWrap='wrap'
          alignItems='flex-start'
        >
          {/* Left: recent calls */}
          <Paper
            rounded
            sx={{ p: 0, flex: '1 1 360px', minWidth: 300, overflow: 'hidden' }}
          >
            <Typography
              variant='subtitle1'
              sx={{ px: 2, pt: 2, pb: 1, fontWeight: 600 }}
            >
              Recent calls · NetSapiens
            </Typography>
            {Divider && <Divider />}
            <Stack divider={Divider ? <Divider /> : undefined}>
              {allCalls.map((c) => {
                const isSel = c.id === selectedId;
                return (
                  <Box
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    sx={{
                      px: 2,
                      py: 1.5,
                      cursor: 'pointer',
                      bgcolor: isSel ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                    }}
                  >
                    <Stack
                      direction='row'
                      spacing={1.5}
                      alignItems='center'
                      sx={{ minWidth: 0 }}
                    >
                      <Typography component='span' sx={{ opacity: 0.6 }}>
                        {c.direction === 'outbound' ? '↑' : '↓'}
                      </Typography>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant='body2'
                          noWrap
                          sx={{ fontWeight: 500 }}
                        >
                          {callLabel(c)}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {c.timeLabel} ·{' '}
                          {c.answered
                            ? formatDuration(c.durationSeconds)
                            : 'missed'}
                        </Typography>
                      </Box>
                    </Stack>
                    {c.source === 'live' && (
                      <Chip
                        label='● Live'
                        color='success'
                        size='small'
                        variant='outlined'
                      />
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Paper>

          {/* Right: matched CRM record (mock data) */}
          <Paper rounded sx={{ flex: '1 1 320px', minWidth: 280 }}>
            <Stack
              direction='row'
              alignItems='center'
              justifyContent='space-between'
              sx={{ mb: 2 }}
            >
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Matched CRM record
              </Typography>
              <Chip label='Sample CRM data' size='small' variant='outlined' />
            </Stack>

            {selectedRecord ? (
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant='h6'>{selectedRecord.name}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {selectedRecord.company}
                  </Typography>
                </Box>
                {Divider && <Divider />}
                <Field
                  label='Last contact'
                  value={selectedRecord.lastContact}
                  T={Typography}
                />
                <Field
                  label='Lifetime calls'
                  value={String(selectedRecord.callCount)}
                  T={Typography}
                />
                <Field
                  label={t?.('NOTES') ?? 'Notes'}
                  value={selectedRecord.notes}
                  T={Typography}
                />
                {Button && (
                  <Button
                    variant='text'
                    sx={{ alignSelf: 'flex-start', px: 0 }}
                    onClick={() => {
                      // Demo: instead of navigating to a live vendor site, reveal
                      // the per-contact deep-link the host would open — showing the
                      // matched contact's data handed off to the CRM.
                      const url = `${VENDOR_CRM_BASE_URL}/contacts/${encodeURIComponent(
                        normalizePhoneNumber(selectedCall?.party ?? ''),
                      )}`;
                      console.info(
                        `[${VENDOR_NAME}] would deep-link contact →`,
                        url,
                      );
                      setDeepLink(url);
                    }}
                  >
                    Open in {VENDOR_NAME} ↗
                  </Button>
                )}
                {deepLink && (
                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ wordBreak: 'break-all' }}
                  >
                    Deep-links this contact into {VENDOR_NAME}:{' '}
                    <code>{deepLink}</code>
                  </Typography>
                )}
              </Stack>
            ) : (
              <Typography variant='body2' color='text.secondary'>
                No CRM match for{' '}
                <strong>{selectedCall ? selectedCall.party : '—'}</strong>. In a
                real integration you'd offer to create the contact here.
              </Typography>
            )}
          </Paper>
        </Stack>

        {Divider && <Divider />}

        {/* Footer — what the SDK made possible on this page. */}
        <Paper rounded>
          <Typography variant='h6' gutterBottom>
            About this integration
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
            This page is injected into the <strong>Manage</strong> menu (after
            Call Logs) by a remote app via the Flow SDK — no host changes, and
            not limited to the Apps menu. It surfaces a third-party CRM{' '}
            <em>inside</em> Flow, something the host doesn't do natively.
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            The recent-call list is a live <code>flowContext.api</code> call to
            the NetSapiens v2 API, proxied and audited by the host — credentials
            never reach this remote. Caller matching reuses the same mock CRM
            directory that powers the inbound-call widget. In a real
            integration, your app would authenticate to the CRM backend on
            behalf of the Flow user via <code>auth.requestRemoteAuth</code> (see
            the <strong>Remote Auth</strong> tab) and pull live records instead
            of mock data.
          </Typography>
        </Paper>
      </Stack>
    </PageTemplate>
  );
}

/** One label/value row in the CRM record card. `T` is the host Typography. */
function Field({
  label,
  value,
  T,
}: {
  label: string;
  value: string;
  T: ComponentType<Record<string, unknown>>;
}) {
  const Box = useFlowContext().ui?.Box;
  if (!Box) return null;
  return (
    <Box>
      <T variant='caption' color='text.secondary'>
        {label}
      </T>
      <T variant='body2'>{value}</T>
    </Box>
  );
}
