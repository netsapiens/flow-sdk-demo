/**
 * CRM Integration — a full page registered into the host's Manage menu by this
 * remote app (parentPath '/manage', placed after Call Logs), proving the Manage
 * tree can be extended, not just /apps.
 *
 * It is the PLATFORM-level CRM page: the connection itself, and the settings
 * that belong to it. Three things a reader should be able to answer here, and
 * nowhere else in the demo:
 *
 *   - Is the CRM connected, as whom, with which scopes, and when did it last
 *     sync?
 *   - Which domains sync with it? (Each row opens that domain's CRM Sync page.)
 *   - How do Flow fields map onto CRM fields?
 *
 * What it deliberately is NOT:
 *
 *   - Not a call list. It used to list the user's recent calls next to their
 *     CRM record, which repeated the host's own Call Logs page. The per-call
 *     CRM view now lives where the calls already are: the "CRM Matched" figure
 *     the Call Logs analytics widget draws under the host's grid.
 *   - Not the domain view. `DomainCrmSyncPage` is registered under
 *     `/manage/:domain` and reads the managed domain with `useManagingDomain()`;
 *     it owns "which users on THIS domain are linked". This page sits at plain
 *     `/manage`, is the same for everyone, and never reads `managing`.
 *
 * Everything on the page is sample data (`mocks/crmConnection.ts`) and says so
 * up front. A real integration would establish the connection with the SDK's
 * remoteAuth flow and read its state from the vendor backend:
 *
 *   const token =
 *     auth.getRemoteAuthToken('example-crm') ??
 *     (await auth.requestRemoteAuth(
 *       { vendorId: 'example-crm', scopes: ['contacts:read'] },
 *       { timeout: 60000 },
 *     ));
 *   const res = await fetch(`${VENDOR_API}/connection`, {
 *     headers: { Authorization: `${token.tokenType ?? 'Bearer'} ${token.accessToken}` },
 *   });
 *
 * No callbackUrl in the request: where the webhook goes is registration data,
 * set by an administrator in Registered Apps. Flow credentials never reach this
 * remote — only the vendor token does.
 */
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useFlowContext, useLocale } from '@netsapiens/flow-sdk';

import type { DomainSyncRow } from '../mocks/crmConnection';
import {
  CONNECTION_STATE,
  CRM_INTEGRATION_COPY as COPY,
  DOMAIN_HEADINGS,
  DOMAIN_SYNC_STATE,
  MAPPING_DIRECTION,
  MAPPING_HEADINGS,
} from '../content/crmIntegrationContent';
import { type ZoneMarkerProps } from '../integration/withZoneTestId';
import {
  SAMPLE_CONNECTION,
  SAMPLE_DOMAIN_SYNC,
  SAMPLE_FIELD_MAPPINGS,
} from '../mocks/crmConnection';

export default function CrmIntegrationPage({ ...marker }: ZoneMarkerProps) {
  const flowContext = useFlowContext();
  const { t } = useLocale();
  const { user, navigate } = flowContext;

  // The signed-in user's own domain leads the table, so at least one "Open"
  // link lands on a domain this server actually has. Its sync state is sample
  // data like the rest; only the name is real.
  const domains = useMemo<DomainSyncRow[]>(() => {
    const own = user?.domain;
    if (!own || SAMPLE_DOMAIN_SYNC.some((d) => d.domain === own)) {
      return [...SAMPLE_DOMAIN_SYNC];
    }
    return [
      {
        domain: own,
        state: 'syncing',
        linkedUsers: 18,
        totalUsers: 21,
        lastSync: SAMPLE_CONNECTION.lastSync,
      },
      ...SAMPLE_DOMAIN_SYNC,
    ];
  }, [user?.domain]);

  const syncing = domains.filter((d) => d.state === 'syncing').length;

  const ui = flowContext.ui;
  const { PageTemplate } = ui?.templates || {};
  const {
    Alert,
    Box,
    Button,
    Chip,
    Paper,
    Stack,
    StatBlock,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
  } = ui || {};

  if (
    !PageTemplate ||
    !Box ||
    !Chip ||
    !Paper ||
    !Stack ||
    !Table ||
    !TableBody ||
    !TableCell ||
    !TableHead ||
    !TableRow ||
    !Typography
  ) {
    return (
      <div {...marker} style={{ padding: 24 }}>
        UI components not available
      </div>
    );
  }

  const connection = CONNECTION_STATE[SAMPLE_CONNECTION.state];

  return (
    <PageTemplate
      {...marker}
      title={COPY.title}
      subtitle={COPY.subtitle}
      breadcrumbs={[
        { label: t?.('MANAGE') ?? 'Manage', url: '/manage' },
        { label: COPY.title },
      ]}
    >
      <Stack spacing={3}>
        {Alert && <Alert severity='info'>{COPY.sampleNotice}</Alert>}

        {/* Connection + last sync, side by side on a wide screen. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}
        >
          <Section
            title={COPY.connectionTitle}
            description={COPY.connectionDescription}
          >
            <Stack direction='row' spacing={1} alignItems='center'>
              <Chip
                size='small'
                variant='outlined'
                color={connection.color}
                label={connection.label}
              />
              <Chip size='small' variant='outlined' label='Sample data' />
            </Stack>
            <Field label='Account' value={SAMPLE_CONNECTION.account} />
            <Field
              label='Connected by'
              value={`${SAMPLE_CONNECTION.connectedBy} · since ${SAMPLE_CONNECTION.connectedSince}`}
            />
            <Field label='Auth' value={SAMPLE_CONNECTION.authMethod} />
            <Box>
              <Typography variant='caption' color='text.secondary'>
                Scopes
              </Typography>
              <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                {SAMPLE_CONNECTION.scopes.map((scope) => (
                  <Chip key={scope} size='small' label={scope} />
                ))}
              </Stack>
            </Box>
          </Section>

          <Section
            title={COPY.lastSyncTitle}
            description={COPY.lastSyncDescription}
          >
            <Field
              label='Last run'
              value={`${SAMPLE_CONNECTION.lastSync} · next ${SAMPLE_CONNECTION.nextSync}`}
            />
            {StatBlock ? (
              <Stack direction='row' spacing={2}>
                <StatBlock
                  value={SAMPLE_CONNECTION.lastRunRecords}
                  caption='records synced'
                  tone='primary'
                />
                <StatBlock
                  value={SAMPLE_CONNECTION.lastRunFailures}
                  caption='failed'
                  tone={
                    SAMPLE_CONNECTION.lastRunFailures > 0 ? 'error' : 'success'
                  }
                />
                <StatBlock
                  value={`${syncing}/${domains.length}`}
                  caption='domains syncing'
                  tone='success'
                />
              </Stack>
            ) : null}
          </Section>
        </Box>

        <Section
          title={COPY.domainsTitle}
          description={COPY.domainsDescription}
        >
          {/* The kit has no TableContainer; a Paper with overflowX is all it did. */}
          <Paper rounded background={1} sx={{ overflowX: 'auto' }}>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  {DOMAIN_HEADINGS.map((heading, i) => (
                    <TableCell key={heading || i}>{heading}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {domains.map((d) => {
                  const state = DOMAIN_SYNC_STATE[d.state];
                  return (
                    <TableRow key={d.domain}>
                      <TableCell>
                        <code>{d.domain}</code>
                        {d.domain === user?.domain ? (
                          <Typography
                            component='span'
                            variant='caption'
                            color='text.secondary'
                          >
                            {' '}
                            · your domain
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size='small'
                          variant='outlined'
                          color={state.color}
                          label={state.label}
                        />
                      </TableCell>
                      <TableCell>
                        {d.state === 'off'
                          ? '—'
                          : `${d.linkedUsers} / ${d.totalUsers}`}
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2' color='text.secondary'>
                          {d.lastSync}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        {Button && navigate ? (
                          // The domain page owns the per-user detail; this
                          // page only links to it.
                          <Button
                            size='small'
                            variant='text'
                            onClick={() =>
                              navigate(
                                `/manage/${encodeURIComponent(d.domain)}/crm-sync`,
                              )
                            }
                          >
                            Open CRM Sync
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        </Section>

        <Section
          title={COPY.mappingTitle}
          description={COPY.mappingDescription}
        >
          <Paper rounded background={1} sx={{ overflowX: 'auto' }}>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  {MAPPING_HEADINGS.map((heading) => (
                    <TableCell key={heading}>{heading}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {SAMPLE_FIELD_MAPPINGS.map((m) => (
                  <TableRow key={m.crmField}>
                    <TableCell>
                      <code>{m.flowField}</code>
                    </TableCell>
                    <TableCell>
                      <code>{m.crmField}</code>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size='small'
                        variant='outlined'
                        label={MAPPING_DIRECTION[m.direction]}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.secondary'>
                        {m.note}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Section>

        {/* Footer — what this page is for, and which page is for the rest. */}
        <Paper rounded>
          <Typography variant='h6' gutterBottom>
            {COPY.aboutTitle}
          </Typography>
          <Stack spacing={1}>
            {COPY.about.map((para) => (
              <Typography key={para} variant='body2' color='text.secondary'>
                {para}
              </Typography>
            ))}
          </Stack>
        </Paper>
      </Stack>
    </PageTemplate>
  );
}

/**
 * A titled, rounded page card. Module-level and reading the live context
 * itself, rather than closing over the page's kit, so it keeps one identity
 * across renders and nothing is prop-drilled.
 */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { ui } = useFlowContext();
  const { Box, Card, CardContent, Stack, Typography } = ui ?? {};
  if (!Box || !Card || !CardContent || !Stack || !Typography) return null;
  return (
    <Card rounded sx={{ height: 1 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant='subtitle1' fontWeight={600}>
              {title}
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              {description}
            </Typography>
          </Box>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** One label/value row inside a Section. */
function Field({ label, value }: { label: string; value: string }) {
  const { ui } = useFlowContext();
  const { Box, Typography } = ui ?? {};
  if (!Box || !Typography) return null;
  return (
    <Box>
      <Typography variant='caption' color='text.secondary'>
        {label}
      </Typography>
      <Typography variant='body2'>{value}</Typography>
    </Box>
  );
}
